LOCAL:  npm install && npm start  -> http://localhost:3000  (admin: /admin.html)

VERCEL DEPLOY:
1. Push this folder to GitHub, import the repo in Vercel (no build settings needed).
2. Vercel project > Storage > create "Blob" store and connect it   (images)
3. Vercel project > Storage / Marketplace > add "Upstash Redis" and connect it (reviews + inquiries + gallery list)
4. Settings > Environment Variables > add ADMIN_PASSWORD = your password
5. Redeploy. Open /admin.html
Vercel cannot write files, so local data.json/uploads are only for local use.
