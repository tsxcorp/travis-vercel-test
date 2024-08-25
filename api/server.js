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
    const { name, company, qrCodeUrl } = req.body;

    if (!name || !company || !qrCodeUrl) {
      return res.status(400).json({ error: 'Invalid input data' });
    }

    // Tải hình ảnh từ URL và chuyển đổi thành buffer
    const response = await axios.get(qrCodeUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'base64');

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

    // Thêm hình ảnh QR code vào PDF từ buffer
    doc.image(imageBuffer, {
      fit: [100, 100],
      align: 'center',
      valign: 'center',
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
