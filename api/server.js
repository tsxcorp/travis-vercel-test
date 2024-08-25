const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const axios = require('axios');
const sharp = require('sharp'); // Thêm sharp để nén hình ảnh
const app = express();

app.use(bodyParser.json());

// Xử lý yêu cầu đến root URL
app.get('/', (req, res) => {
  res.send('API is running. Use POST /generate-pdf to generate a PDF.');
});

// Xử lý yêu cầu POST đến /generate-pdf
app.post('/generate-pdf', async (req, res) => {
  try {
    let { name, company, qrCodeUrl, headerUrl, footerUrl } = req.body;

    // Thiết lập giá trị mặc định nếu tham số trống hoặc null
    name = name || 'VISITOR';
    company = company || 'No Company Provided';
    qrCodeUrl = qrCodeUrl || 'https://via.placeholder.com/150'; // Sử dụng hình ảnh mặc định nếu không có URL QR
    headerUrl = headerUrl || 'https://via.placeholder.com/595x60'; // Sử dụng header mặc định
    footerUrl = footerUrl || 'https://via.placeholder.com/595x40'; // Sử dụng footer mặc định

    // Tải hình ảnh từ URL và nén bằng sharp
    const qrResponse = await axios.get(qrCodeUrl, { responseType: 'arraybuffer' });
    const headerResponse = await axios.get(headerUrl, { responseType: 'arraybuffer' });
    const footerResponse = await axios.get(footerUrl, { responseType: 'arraybuffer' });

    // Nén hình ảnh header và footer, giữ nguyên QR code
    const compressedHeader = await sharp(headerResponse.data)
      .resize(595, 60) // Điều chỉnh kích thước
      .jpeg({ quality: 60 }) // Nén với chất lượng 60%
      .toBuffer();

    const compressedFooter = await sharp(footerResponse.data)
      .resize(595, 40) // Điều chỉnh kích thước
      .jpeg({ quality: 60 }) // Nén với chất lượng 60%
      .toBuffer();

    // Không nén QR code, giữ nguyên kích thước 215x215
    const qrImageBuffer = Buffer.from(qrResponse.data, 'base64');

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

    // Thêm nội dung vào PDF
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

    // Thêm hình ảnh QR code vào PDF từ buffer
    doc.image(qrImageBuffer, {
      fit: [215, 215], // Giữ nguyên kích thước QR code
      align: 'center',
      valign: 'center',
      x: (doc.page.width - 215) / 2, // Căn giữa theo chiều ngang
      y: doc.y
    });

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
