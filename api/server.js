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
        let { type, name, company, indEncryptKey, groupEncryptKey, memberEncryptKeys, headerUrl, footerUrl, line } = req.body;

        // Thiết lập giá trị mặc định nếu tham số trống hoặc null
        type = type || 'ind';
        name = name || 'VISITOR';
        company = company || 'No Company Provided';
        indEncryptKey = indEncryptKey || 'DefaultIndividualKey';
        groupEncryptKey = groupEncryptKey || 'DefaultGroupKey';
        memberEncryptKeys = memberEncryptKeys || [];  // Danh sách đối tượng có trường `name` và `encryptKey`
        headerUrl = headerUrl || 'https://via.placeholder.com/595x60';
        footerUrl = footerUrl || 'https://via.placeholder.com/595x40';
        line = line || 'Default Line';  // Thiết lập giá trị mặc định cho line

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

        // Tạo file PDF với chiều cao động cho nhóm, và cố định khổ A5 cho cá nhân
        const pageHeight = type === 'ind' ? 595 : 300 + memberQRCodes.length * 150; // Chiều cao động cho nhóm, khổ A5 cho cá nhân
        const docSize = type === 'ind' ? 'A5' : [595, pageHeight];

        // Tạo file PDF với kích thước xác định
        const doc = new PDFDocument({ size: docSize, margin: 50, compress: true });
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
        doc.registerFont('Poppins-SemiBold', path.join(__dirname, 'fonts/Poppins-SemiBold.ttf'));


        // Thêm hình ảnh header đã nén
        doc.image(compressedHeader, 0, 0, {
            width: doc.page.width,
            height: 60
        });

        doc.moveDown(2.5); // Khoảng trống sau header

        if (type === 'ind') {
            // Layout cho cá nhân
            doc.font('Poppins-Medium');
            doc.fontSize(32).text(name, {
                align: 'center',
                lineGap: 10,
            });

            doc.font('Poppins');
            doc.fontSize(16).text(company, {
                align: 'center',
                lineGap: 10,
            });

            // Hiển thị thông tin Line bên dưới QR code
            doc.font('Poppins-Medium').fontSize(18).text(`[Counter Line]: ${line}`, {
                align: 'center',
                lineGap: 5
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
            doc.font('Poppins-Medium').fontSize(14).text("YOUR GROUP'S BADGES INFORMATION:", { align: 'center' });
            doc.moveDown(0.5);

            // Hiển thị thông tin Line 
            doc.font('Poppins-Medium').fontSize(18).text(`[Counter Line]: ${line}`, {
              align: 'center',
              lineGap: 5
          });

            // Thông tin công ty và danh sách các thành viên
            doc.font('Poppins-SemiBold').fontSize(24).text(company, { align: 'center' });
            doc.moveDown(0.75);

            // Hiển thị QR code của nhóm
            doc.image(qrCodeGroup, {
                fit: [200, 200],
                align: 'center',
                valign: 'center',
                x: (doc.page.width - 200) / 2,
                y: doc.y
            });

            doc.moveDown(6.5);

            // Thêm thông báo QR cho từng thành viên
            memberQRCodes.forEach((member, index) => {
                const boxHeight = 100;
                const boxMargin = 10;

                // Kiểm tra nếu không đủ chỗ, tạo trang mới
                if (doc.y + boxHeight + boxMargin > doc.page.height - 60) {
                    doc.addPage();
                    // Thêm header ở mỗi trang mới
                    doc.image(compressedHeader, 0, 0, {
                        width: doc.page.width,
                        height: 60
                    });
                    doc.moveDown(2.5);
                }

                // Vẽ khung hình cho mỗi thành viên
                doc.lineWidth(0.25);
                doc.strokeColor('black', 0.3); // Màu đen với độ trong suốt 0.5
                doc.rect(50, doc.y, 495, boxHeight).stroke(); 

                // Hiển thị tên thành viên với khoảng cách dòng nhỏ hơn
                doc.font('Poppins-Medium').fontSize(9).text(`Use this code for individual check-in.`, 60, doc.y + 10, {
                  align: 'center',
                  lineGap: 1 // Giảm khoảng cách dòng
                });
                doc.font('Poppins-Medium').fontSize(18).text(`#${index + 1}: ${member.name}`, 60, doc.y + 15, {
                  align: 'center',
                  lineGap: 4 // Giảm khoảng cách dòng
                });


                // Hiển thị QR code thành viên
                doc.image(member.qrCode, {  
                    width: 120,
                    height: 120,
                    x: (doc.page.width - 120) / 2,
                    y: doc.y - 10
                });

                doc.moveDown(boxHeight / 30); // Di chuyển xuống dưới để không chồng chéo lên thành viên tiếp theo
                doc.y += boxHeight + boxMargin; // Cập nhật vị trí y để vẽ khung thành viên kế tiếp
            });
        }

        // Thêm hình ảnh footer đã nén
        const footerHeight = 40; // Chiều cao của footer

        // Kiểm tra và đảm bảo đủ khoảng trống cho footer
        if (doc.y + footerHeight > pageHeight) {
            doc.addPage(); // Thêm trang mới nếu không đủ chỗ cho footer
        }

        // Vẽ footer
        doc.image(compressedFooter, 0, doc.page.height - footerHeight, {
            width: doc.page.width, // Đặt chiều rộng của footer bằng chiều rộng của trang
            height: footerHeight,  // Đặt chiều cao của footer
            align: 'center',       // Canh giữa nếu cần
            valign: 'center'       // Canh giữa nếu cần
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
  let option = req.query.option || '{}';  // Sử dụng JSON cho option

  // Kiểm tra xem option có phải là JSON hợp lệ hay không
  try {
      option = JSON.parse(option);
  } catch (e) {
      // Nếu không phải JSON hợp lệ, coi option như một đoạn văn bản đơn giản
      option = {
          text: option,
          size: 20,  // Kích thước mặc định
          style: 'normal',  // Kiểu chữ mặc định
          weight: 'normal'  // Độ dày mặc định
      };
  }

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
                                .replace('{{qrCodeUrl}}', qrCodeDataUrl)
                                .replace('{{option}}', JSON.stringify(option)); // Thêm option vào HTML dưới dạng chuỗi JSON

          res.send(htmlContent);
      });
  } catch (error) {
      console.error('Error generating QR Code:', error);
      res.status(500).send('Error generating QR Code');
  }
});



// Access 
app.get('/nev-registration', );

// Lắng nghe yêu cầu trên một cổng cụ thể
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
