# OJT Blog Site

A modern blog application built with vanilla JavaScript, Node.js, and PostgreSQL. Features a clean admin dashboard, analytics tracking, and responsive design.

## 🚀 Features

- **Modern Blog Interface**: Clean, responsive design with light/dark theme toggle
- **Admin Dashboard**: Full content management with analytics
- **Video Integration**: YouTube video embedding support
- **Analytics Tracking**: Visitor tracking and insights
- **Comment System**: User engagement with comments
- **SEO Friendly**: Clean URLs with slugs

## 🛠️ Tech Stack

**Frontend:**
- Vanilla HTML, CSS, JavaScript
- Responsive CSS Grid & Flexbox
- Chart.js for analytics visualization
- Font Awesome icons

**Backend:**
- Node.js with Express
- PostgreSQL database with Supabase
- JWT authentication
- Rate limiting & security middleware

## 📦 Deployment

### Vercel (Recommended)

1. Clone this repository
2. Install Vercel CLI: `npm i -g vercel`
3. Set up environment variables in Vercel:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `JWT_SECRET`: Secret key for JWT tokens
   - `ADMIN_EMAIL`: Admin user email
   - `ADMIN_PASSWORD`: Admin user password
4. Deploy: `vercel --prod`

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/zionren/OJTblogsite.git
cd OJTblogsite
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
DATABASE_URL=your_postgresql_url
JWT_SECRET=your_jwt_secret
ADMIN_EMAIL=your_admin_email
ADMIN_PASSWORD=your_admin_password
PORT=4488
```

4. Start the server:
```bash
npm start
```

## 🎯 Usage

### Admin Access
- Visit `/admin` to access the admin dashboard
- Login with your admin credentials
- Create, edit, and manage blog posts
- View analytics and visitor insights

### Features
- **Posts Management**: Create rich content with markdown support
- **Analytics Dashboard**: Track page views, popular posts, and engagement
- **Theme System**: Light/dark mode with custom CSS variables
- **Responsive Design**: Works on all devices

## 📂 Project Structure

```
├── public/
│   ├── css/
│   ├── js/
│   ├── images/
│   └── *.html
├── database/
│   └── schema.js
├── server.js
├── package.json
└── vercel.json
```

## 🔧 Configuration

The application uses environment variables for configuration:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token generation
- `ADMIN_EMAIL`: Default admin user email
- `ADMIN_PASSWORD`: Default admin user password
- `PORT`: Server port (default: 5000)

## 📄 License

MIT License - feel free to use this project for your own blog!

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
