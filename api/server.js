const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const axios = require('axios'); // Thêm axios để tải hình ảnh từ URL
const app = express();

app.use(bodyParser.json());

// Xử lý yêu cầu đến root URL
app.get('/', (req, res) => {
  res.send('API is running. Use POST /generate-pdf to generate a PDF.');
});

// Xử lý yêu cầu POST đến /generate-pdf
app.post('/generate-pdf', async (req, res) => {
  try {
    const { name, company, qrCodeUrl, headerUrl, footerUrl } = req.body;

    if (!name || !company || !qrCodeUrl || !headerUrl || !footerUrl) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    // Tải hình ảnh header, footer, và QR code từ URL
    const qrResponse = await axios.get(qrCodeUrl, { responseType: 'arraybuffer' });
    const headerResponse = await axios.get(headerUrl, { responseType: 'arraybuffer' });
    const footerResponse = await axios.get(footerUrl, { responseType: 'arraybuffer' });

    const qrImageBuffer = Buffer.from(qrResponse.data, 'base64');
    const headerImageBuffer = Buffer.from(headerResponse.data, 'base64');
    const footerImageBuffer = Buffer.from(footerResponse.data, 'base64');

    // Tạo file PDF với khổ A5
    const doc = new PDFDocument({ size: 'A5', margin: 50 }); // Thiết lập margin để tránh nội dung quá sát biên
    let buffers = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      let pdfData = Buffer.concat(buffers);
      let base64data = pdfData.toString('base64');
      res.json({ base64: base64data });
    });

    // Thêm hình ảnh header
    doc.image(headerImageBuffer, 0, 0, {
      width: doc.page.width, // Chiều rộng bằng chiều rộng trang
      height: 60             // Chiều cao header khoảng 60 pixels
    });

    // Thêm khoảng trống sau header để nội dung không chồng lên nhau
    doc.moveDown(4); // Di chuyển xuống dưới để tạo khoảng trống sau header

    // Thêm nội dung vào PDF
    doc.fontSize(38).text(name, {
      align: 'center',
      lineGap: 10,
    });
    doc.moveDown(0.5); // Khoảng cách giữa tên và công ty
    doc.fontSize(16).text(company, {
      align: 'center',
      lineGap: 10,
    });
    doc.moveDown(2); // Khoảng cách giữa văn bản và QR code

    // Thêm hình ảnh QR code vào PDF từ buffer
    doc.image(qrImageBuffer, {
      fit: [100, 100],
      align: 'center',
      valign: 'center',
      x: (doc.page.width - 100) / 2, // Căn giữa QR code theo chiều ngang
      y: doc.y                       // Đặt QR code ở vị trí hiện tại của con trỏ
    });

    // Thêm hình ảnh footer
    doc.image(footerImageBuffer, 0, doc.page.height - 50, {
      width: doc.page.width, // Chiều rộng bằng chiều rộng trang
      height: 40             // Chiều cao footer khoảng 40 pixels
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
