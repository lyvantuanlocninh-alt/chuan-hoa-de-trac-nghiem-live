import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.set('trust proxy', true);
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use(session({
    secret: 'quiz-generator-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { 
      secure: true, 
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  }));

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // The redirect URI is dynamic, so we'll build it in the route
  );

  // API Routes
  app.get('/api/auth/google/url', (req, res) => {
    const origin = (req.query.origin as string) || `https://${req.headers.host}`;
    const redirectUri = `${origin}/auth/google/callback`;

    // Store origin in session for the callback to use the exact same redirect URI
    (req.session as any).authOrigin = origin;

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ],
      prompt: 'consent',
      redirect_uri: redirectUri
    });

    res.json({ url });
  });

  app.get('/auth/google/callback', async (req: any, res) => {
    const { code } = req.query;
    const origin = req.session.authOrigin || `https://${req.headers.host}`;
    const redirectUri = `${origin}/auth/google/callback`;

    try {
      const { tokens } = await oauth2Client.getToken({
        code: code as string,
        redirect_uri: redirectUri
      });
      
      req.session.tokens = tokens;
      
      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc;">
            <div style="text-align: center; p: 2rem; background: white; border-radius: 1rem; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h2 style="color: #4f46e5;">Kết nối Google thành công!</h2>
              <p style="color: #64748b;">Cửa sổ này sẽ tự động đóng lại...</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
                  setTimeout(() => window.close(), 1000);
                } else {
                  window.location.href = '/';
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Google Auth Error:', error);
      res.status(500).send('Authentication failed');
    }
  });

  app.get('/api/auth/status', (req: any, res) => {
    res.json({ isAuthenticated: !!req.session.tokens });
  });

  app.post('/api/export/googlesheet', async (req: any, res) => {
    if (!req.session.tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { data, title, meta = {} } = req.body;
    
    try {
      oauth2Client.setCredentials(req.session.tokens);
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // 1. Process images: Upload SVGs to Google Drive and get public links
      const processedData = await Promise.all(data.map(async (row: any) => {
        const svgMatch = row.image && row.image.match(/<svg[\s\S]*?<\/svg>/i);
        if (svgMatch) {
          try {
            const svgContent = svgMatch[0];
            const fileName = `quiz_image_${row.id || Date.now()}.svg`;
            
            // Create file on Drive
            const fileMetadata = {
              name: fileName,
              mimeType: 'image/svg+xml',
            };
            const media = {
              mimeType: 'image/svg+xml',
              body: svgContent,
            };
            
            const file = await drive.files.create({
              requestBody: fileMetadata,
              media: media,
              fields: 'id, webViewLink',
            });

            const fileId = file.data.id!;
            
            // Make public
            await drive.permissions.create({
              fileId: fileId,
              requestBody: {
                role: 'reader',
                type: 'anyone',
              },
            });

            // Get direct download link or webViewLink
            // Direct link: https://drive.google.com/uc?id=[FILE_ID]
            return { ...row, image: `https://drive.google.com/uc?id=${fileId}` };
          } catch (imgError) {
            console.error('Error uploading image to Drive:', imgError);
            return row;
          }
        }
        return row;
      }));

      // 2. Create the spreadsheet
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: title || 'Quiz Generated Content'
          }
        }
      });

      const spreadsheetId = spreadsheet.data.spreadsheetId!;
      const now = new Date().toLocaleString('vi-VN');

      // 3. Build the structure
      const rows = [];

      // __META__ Section
      rows.push(['__META__']);
      rows.push(['title', title || '']);
      rows.push(['grade', meta.grade || '']);
      rows.push(['subject', meta.subject || '']);
      rows.push(['examType', meta.examType || '']);
      rows.push(['chapter', meta.chapter || '']);
      rows.push(['lesson', meta.lesson || '']);
      rows.push(['examNumber', meta.examNumber || '']);
      rows.push(['sortOrder', meta.sortOrder || '']);
      rows.push(['description', meta.description || '']);
      rows.push(['createdAt', now]);
      rows.push(['updatedAt', now]);
      rows.push([]); // Empty row

      // __CONFIG__ Section
      rows.push(['__CONFIG__']);
      rows.push(['id', 'timeLimit', 'scoreScale']);
      processedData.forEach(row => {
        rows.push([row.id, row.timeLimit || '', row.scoreScale || '']);
      });
      rows.push([]); // Empty row

      // __QUESTIONS__ Section
      rows.push(['__QUESTIONS__']);
      rows.push(['id', 'content', 'optionA', 'optionB', 'optionC', 'optionD', 'answer', 'type', 'explanation', 'image']);
      processedData.forEach(row => {
        rows.push([
          row.id,
          row.content,
          row.optionA,
          row.optionB,
          row.optionC,
          row.optionD,
          row.answer,
          row.type,
          row.explanation,
          row.image || ''
        ]);
      });
      rows.push([]); // Empty row

      // __RESULTS__ Section
      rows.push(['__RESULTS__']);
      rows.push(['savedAt', 'studentName', 'score', 'history', 'warningCount', 'warningDetail']);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: rows
        }
      });

      res.json({ 
        success: true, 
        spreadsheetId, 
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}` 
      });
    } catch (error) {
      console.error('Export Error:', error);
      res.status(500).json({ error: 'Failed to export to Google Sheets' });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
