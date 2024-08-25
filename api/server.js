const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
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

        let htmlContent;
        if (type === 'group') {
            // Sử dụng template khác cho nhóm
            htmlContent = fs.readFileSync(path.join(__dirname, 'template-group.html'), 'utf8');
            htmlContent = htmlContent.replace('{{qrCodeUrlGroup}}', qrCodeUrlGroup);
        } else {
            // Sử dụng template cho cá nhân
            htmlContent = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
        }

        htmlContent = htmlContent.replace('{{name}}', name)
            .replace('{{company}}', company)
            .replace('{{qrCodeUrl}}', qrCodeUrl)
            .replace('{{headerUrl}}', headerUrl)
            .replace('{{footerUrl}}', footerUrl);

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'load' });
        const pdfBuffer = await page.pdf({ format: 'A5', printBackground: true });

        await browser.close();

        const base64data = pdfBuffer.toString('base64');
        res.json({ base64: base64data });

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
