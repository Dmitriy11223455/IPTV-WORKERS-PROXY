import express from 'express';
import worker from './worker.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.all('*', async (req, res) => {
    try {
        const protocol = req.protocol;
        const host = req.get('host');
        const fullUrl = `${protocol}://${host}${req.originalUrl}`;
        
        // Создаем объект Request как в Cloudflare Workers
        const cfRequest = new Request(fullUrl, {
            method: req.method,
            headers: req.headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : req
        });

        // Передаем запрос в ваш оригинальный воркер
        const cfResponse = await worker.fetch(cfRequest);

        // Возвращаем ответ обратно в IPTV-плеер
        res.status(cfResponse.status);
        cfResponse.headers.forEach((value, key) => res.setHeader(key, value));
        
        const bodyReader = cfResponse.body?.getReader();
        if (bodyReader) {
            while (true) {
                const { done, value } = await bodyReader.read();
                if (done) break;
                res.write(value);
            }
        }
        res.end();
    } catch (err) {
        console.error('Ошибка в работе прокси:', err);
        res.status(500).send('Proxy Error');
    }
});

app.listen(PORT, () => console.log(`Прокси-сервер запущен на порту ${PORT}`));

