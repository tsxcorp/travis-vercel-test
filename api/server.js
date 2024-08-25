const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(bodyParser.json());

// Xử lý yêu cầu đến root URL
app.get('/', (req, res) => {
    res.send('API is running. Use GET /print-badge to print a badge or POST /generate-pdf to generate a PDF.');
});

// Xử lý yêu cầu GET đến /print-badge
app.get('/print-badge', (req, res) => {
    const name = req.query.name || 'Tên Mặc Định';
    const company = req.query.company || 'Công ty Mặc Định';
    const qrCodeUrl = req.query.qrCodeUrl || 'https://via.placeholder.com/150';

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
            .replace('{{qrCodeUrl}}', qrCodeUrl);

        res.send(htmlContent);
    });
});

// Xử lý yêu cầu POST đến /generate-pdf
app.post('/generate-pdf', (req, res) => {
    const { name, company, qrCodeUrl } = req.body;

    // Giả lập việc tạo file PDF (chỉ đơn giản trả về nội dung JSON)
    if (!name || !company || !qrCodeUrl) {
        return res.status(400).json({ error: 'Invalid input data' });
    }

    const pdfContent = {
        name: name,
        company: company,
        qrCodeUrl: qrCodeUrl,
        message: 'PDF generated successfully!',
        base64: 'base64-string-of-pdf-content'
    };

    res.json(pdfContent);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;