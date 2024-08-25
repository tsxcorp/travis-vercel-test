const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');
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
    let { type, name, company, qrCodeUrl, qrCodeUrlGroup, headerUrl, footerUrl } = req.body;

    // Thiết lập giá trị mặc định nếu tham số trống hoặc null
    type = type || 'ind';
    name = name || 'VISITOR';
    company = company || 'No Company Provided';
    qrCodeUrl = qrCodeUrl || 'https://via.placeholder.com/150';
    qrCodeUrlGroup = qrCodeUrlGroup || 'https://via.placeholder.com/150';
    headerUrl = headerUrl || 'https://via.placeholder.com/595x60';
    footerUrl = footerUrl || 'https://via.placeholder.com/595x40';

    // Tải hình ảnh từ URL và nén bằng sharp
    const qrResponse = await axios.get(qrCodeUrl, { responseType: 'arraybuffer' });
    const qrGroupResponse = await axios.get(qrCodeUrlGroup, { responseType: 'arraybuffer' });
    const headerResponse = await axios.get(headerUrl, { responseType: 'arraybuffer' });
    const footerResponse = await axios.get(footerUrl, { responseType: 'arraybuffer' });

    const qrImageBuffer = Buffer.from(qrResponse.data, 'base64');
    const qrGroupImageBuffer = Buffer.from(qrGroupResponse.data, 'base64');

    const compressedHeader = await sharp(headerResponse.data).png({ quality: 60 }).toBuffer();
    const compressedFooter = await sharp(footerResponse.data).png({ quality: 60 }).toBuffer();

    // Tạo file PDF với khổ A5 và giảm chất lượng hình ảnh
    const doc = new PDFDocument({ size: 'A5', margin: 50, compress: true });
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

    doc.moveDown(4); // Khoảng trống sau header

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

      // Thêm hình ảnh QR code cá nhân
      doc.image(qrImageBuffer, {
        fit: [215, 215],
        align: 'center',
        valign: 'center',
        x: (doc.page.width - 215) / 2,
        y: doc.y
      });
    } else if (type === 'group') {
      // Layout cho nhóm

      // Bố trí thông tin công ty
      doc.font('Poppins-Bold').fontSize(18).text(company, { align: 'center' });
      doc.moveDown(1.5);

      // Thiết lập bảng để hiển thị QR code và thông tin
      const tableTop = doc.y;
      const column1Left = 50;
      const column2Left = doc.page.width / 2 + 20;

      // Thông tin của nhóm và QR code nhóm
      doc.font('Poppins').fontSize(12).text('Scan this QR to print all your Group Badges', column1Left, tableTop);
      doc.image(qrGroupImageBuffer, column1Left, tableTop + 20, { width: 100, height: 100 });

      // Thông tin cá nhân và QR code cá nhân
      const memberInfoTop = tableTop + 150;
      doc.font('Poppins').fontSize(12).text('Scan this QR to print only your Badge', column1Left, memberInfoTop);
      doc.image(qrImageBuffer, column1Left, memberInfoTop + 20, { width: 100, height: 100 });

      // Hiển thị tên
      doc.font('Poppins-Bold').fontSize(16).text(name, column2Left, memberInfoTop + 50);
    }

    // Thêm hình ảnh footer đã nén
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

// Thêm endpoint mới cho in thẻ đeo
app.get('/print-badge', (req, res) => {
  const name = req.query.name || 'Tên Mặc Định';
  const company = req.query.company || 'Công ty Mặc Định';
  const qrCodeUrl = req.query.qrCodeUrl || 'https://via.placeholder.com/150';  // Sử dụng trực tiếp URL của hình ảnh QR code

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
                            .replace('{{qrCodeUrl}}', qrCodeUrl);  // Sử dụng URL QR code trực tiếp

      res.send(htmlContent);
  });
});

// Lắng nghe yêu cầu trên một cổng cụ thể
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
