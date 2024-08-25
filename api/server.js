const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp');
const app = express();

app.use(bodyParser.json());

// Xử lý yêu cầu đến root URL
app.get('/', (req, res) => {
  res.send('API is running. Use POST /generate-pdf to generate a PDF.');
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
    const path = require('path');
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

      // Thông tin của nhóm
      doc.font('Poppins-Bold');
      doc.fontSize(20).text('Group Information', {
        align: 'center',
        lineGap: 5,
      });

      doc.font('Poppins');
      doc.fontSize(12).text('Group QR Code:', {
        align: 'center',
        lineGap: 5,
      });

      // Thêm QR code của nhóm
      doc.image(qrGroupImageBuffer, {
        fit: [150, 150],
        align: 'center',
        valign: 'center',
        x: (doc.page.width - 150) / 2,
        y: doc.y
      });

      doc.moveDown(1.5); // Khoảng cách sau QR code nhóm

      // Thông tin cá nhân
      doc.font('Poppins-Bold');
      doc.fontSize(20).text('Member Information', {
        align: 'center',
        lineGap: 5,
      });

      doc.font('Poppins');
      doc.fontSize(12).text(name, {
        align: 'center',
        lineGap: 5,
      });

      doc.font('Poppins');
      doc.fontSize(12).text(company, {
        align: 'center',
        lineGap: 5,
      });

      // Thêm QR code cá nhân
      doc.image(qrImageBuffer, {
        fit: [150, 150],
        align: 'center',
        valign: 'center',
        x: (doc.page.width - 150) / 2,
        y: doc.y
      });
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

// Lắng nghe yêu cầu trên một cổng cụ thể
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
