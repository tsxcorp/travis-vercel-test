const express = require('express');
const bodyParser = require('body-parser');
const PDFDocument = require('pdfkit');
const app = express();

app.use(bodyParser.json());

// Xử lý yêu cầu đến root URL
app.get('/', (req, res) => {
  res.send('API is running. Use POST /generate-pdf to generate a PDF.');
});

// Xử lý yêu cầu POST đến /generate-pdf
app.post('/generate-pdf', (req, res) => {
  const { name, company, qrCodeUrl } = req.body;

  if (!name || !company || !qrCodeUrl) {
    return res.status(400).json({ error: 'Invalid input data' });
  }

  // Tạo file PDF
  const doc = new PDFDocument();
  let buffers = [];

  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    let pdfData = Buffer.concat(buffers);
    let base64data = pdfData.toString('base64');
    res.json({ base64: base64data });
  });

  // Thêm nội dung vào PDF
  doc.fontSize(25).text('Name: ' + name, 100, 100);
  doc.fontSize(20).text('Company: ' + company, 100, 140);

  // Thêm hình ảnh QR code vào PDF
  doc.image(qrCodeUrl, {
    fit: [100, 100],
    align: 'center',
    valign: 'center',
  });

  doc.end(); // Kết thúc tạo file PDF
});

// Lắng nghe yêu cầu trên một cổng cụ thể
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
