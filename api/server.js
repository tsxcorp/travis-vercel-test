const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');
const qrcode = require('qrcode');  // Thêm thư viện QR code
const fs = require('fs');
const path = require('path');
const app = express();

app.use(bodyParser.json());

// Xử lý yêu cầu đến root URL
app.get('/', (req, res) => {
    res.send('API is running. Use POST /generate-pdf to generate a PDF or GET /print-badge to print a badge.');
});

// Xử lý yêu cầu POST đến /generate-pdf
app.post('/generate-pdf', async (req, res) => {
    try {
        let { type, name, company, indEncryptKey, groupEncryptKey, memberEncryptKeys, headerUrl, footerUrl } = req.body;

        // Thiết lập giá trị mặc định nếu tham số trống hoặc null
        type = type || 'ind';
        name = name || 'VISITOR';
        company = company || 'No Company Provided';
        indEncryptKey = indEncryptKey || 'DefaultIndividualKey';
        groupEncryptKey = groupEncryptKey || 'DefaultGroupKey';
        memberEncryptKeys = memberEncryptKeys || [];  // Danh sách đối tượng có trường `name` và `encryptKey`
        headerUrl = headerUrl || 'https://via.placeholder.com/595x60';
        footerUrl = footerUrl || 'https://via.placeholder.com/595x40';

        // Sử dụng thư viện qrcode để tạo QR code từ các encrypt key
        const qrCodeInd = await qrcode.toDataURL(indEncryptKey); // Tạo QR code cho cá nhân
        const qrCodeGroup = await qrcode.toDataURL(groupEncryptKey); // Tạo QR code cho nhóm

        // Tạo mã QR cho từng thành viên
        const memberQRCodes = await Promise.all(
            memberEncryptKeys.map(async member => ({
                name: member.name,
                qrCode: await qrcode.toDataURL(member.encryptKey)
            }))
        );

        // Tải hình ảnh header và footer từ URL và nén bằng sharp
        const headerResponse = await axios.get(headerUrl, { responseType: 'arraybuffer' });
        const footerResponse = await axios.get(footerUrl, { responseType: 'arraybuffer' });

        const compressedHeader = await sharp(headerResponse.data).png({ quality: 60 }).toBuffer();
        const compressedFooter = await sharp(footerResponse.data).png({ quality: 60 }).toBuffer();

        // Tạo file PDF với khổ A4 để hỗ trợ nhiều nội dung
        const doc = new PDFDocument({ size: 'A4', margin: 50, compress: true });
        let buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            let pdfData = Buffer.concat(buffers);
            let base64data = pdfData.toString('base64');
            res.json({ base64: base64data });
        });

        // Đăng ký font Poppins
        doc.registerFont('Poppins', path.join(__dirname, 'fonts/Poppins-Regular.ttf'));
        doc.registerFont('Poppins-Bold', path.join(__dirname, 'fonts/Poppins-Bold.ttf'));
        doc.registerFont('Poppins-Medium', path.join(__dirname, 'fonts/Poppins-Medium.ttf'));

        // Thêm hình ảnh header đã nén
        doc.image(compressedHeader, 0, 0, {
            width: doc.page.width,
            height: 60
        });

        doc.moveDown(2); // Khoảng trống sau header

        if (type === 'ind') {
            // Layout cho cá nhân
            doc.font('Poppins-Bold');
            doc.fontSize(38).text(name, {
                align: 'center',
                lineGap: 10,
            });

            doc.font('Poppins');
            doc.fontSize(16).text(company, {
                align: 'center',
                lineGap: 10,
            });

            // Thêm hình ảnh QR code cá nhân từ Data URL
            doc.image(qrCodeInd, {
                fit: [215, 215],
                align: 'center',
                valign: 'center',
                x: (doc.page.width - 215) / 2,
                y: doc.y
            });
        } else if (type === 'group') {
            // Layout cho nhóm
            doc.font('Poppins-Bold').fontSize(24).text('Group Badge', { align: 'center' });
            doc.moveDown(1.5);

            // Hiển thị QR code của nhóm
            doc.image(qrCodeGroup, {
                fit: [250, 250],
                align: 'center',
                valign: 'center',
                x: (doc.page.width - 250) / 2,
                y: doc.y
            });

            doc.moveDown(2);

            // Thông tin công ty và danh sách các thành viên
            doc.font('Poppins-Bold').fontSize(18).text(company, { align: 'center' });
            doc.moveDown(1.5);

            memberQRCodes.forEach((member, index) => {
                if (doc.y + 120 > doc.page.height - 50) {
                    // Thêm trang mới nếu không đủ không gian
                    doc.addPage();
                    doc.image(compressedHeader, 0, 0, {
                        width: doc.page.width,
                        height: 60
                    });
                    doc.moveDown(2);
                }

                doc.font('Poppins-Bold').fontSize(14).text(`Member ${index + 1}: ${member.name}`, 50, doc.y);
                doc.image(member.qrCode, {
                    width: 100,
                    height: 100,
                    x: doc.page.width / 2 + 50,
                    y: doc.y
                });

                doc.moveDown(3); // Di chuyển xuống sau mỗi mã QR của thành viên
            });
        }

        // Thêm hình ảnh footer đã nén trên trang cuối
        doc.image(compressedFooter, 0, doc.page.height - 50, {
            width: doc.page.width,
            height: 40
        });

        doc.end(); // Kết thúc tạo file PDF
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Xử lý yêu cầu GET đến /print-badge
app.get('/print-badge', async (req, res) => {
    const name = req.query.name || 'Tên Mặc Định';
    const company = req.query.company || 'Công ty Mặc Định';
    const encryptKey = req.query.encryptKey || 'Mặc Định';

    // Sử dụng thư viện qrcode để tạo QR code từ encryptKey
    try {
        const qrCodeDataUrl = await qrcode.toDataURL(encryptKey); // Tạo QR code dưới dạng Data URL

        // Đọc nội dung từ file HTML
        fs.readFile(path.join(__dirname, 'badge.html'), 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading HTML file:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

            // Thay thế placeholders bằng dữ liệu thực tế
            let htmlContent = data.replace('{{name}}', name)
                                  .replace('{{company}}', company)
                                  .replace('{{qrCodeUrl}}', qrCodeDataUrl); // Sử dụng Data URL của QR code

            res.send(htmlContent);
        });
    } catch (error) {
        console.error('Error generating QR Code:', error);
        res.status(500).send('Error generating QR Code');
    }
});

// Lắng nghe yêu cầu trên một cổng cụ thể
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
