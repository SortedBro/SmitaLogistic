# 🚚 Smita Logistics Web App (EJS + Node.js)

A full-stack logistics booking and tracking web application built using **Node.js, Express, MongoDB, and EJS**.
This platform allows users to book shipments, track orders, and contact support, while providing an admin dashboard for management.

---

## 📂 Project Structure

```
smita-ejs/
├── server.js              # Main server entry point
├── package.json           # Dependencies & scripts
├── .env.example           # Environment variables template

├── config/
│   ├── db.js              # MongoDB connection
│   └── delhivery.js       # Delhivery API integration

├── models/
│   ├── Order.js           # Order schema
│   └── Contact.js         # Contact schema

├── middleware/
│   └── adminAuth.js       # Admin authentication middleware

├── routes/
│   ├── pages.js           # Public routes (Home, Book, Track, Contact)
│   └── admin.js           # Admin routes (Dashboard, Orders, Messages)

└── views/
    ├── partials/
    │   ├── head.ejs
    │   ├── navbar.ejs
    │   ├── footer.ejs
    │   └── flash.ejs
    └── pages/
        ├── home.ejs
        ├── book.ejs
        ├── track.ejs
        ├── contact.ejs
        ├── admin-login.ejs
        └── admin-dashboard.ejs
```

---

## ⚙️ Features

### 👤 User Features

* 📦 Book shipment (form-based)
* 🔍 Track shipment (live timeline view)
* 📩 Contact form
* ✅ Success & error flash messages

### 🔐 Admin Features

* 🔑 Secure login (middleware protected)
* 📊 Dashboard overview
* 📦 Manage orders
* 📬 View customer messages

### 🔌 Integrations

* 🚚 Delhivery API (for logistics tracking & booking)
* 🗄️ MongoDB database

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js
* **Frontend:** EJS, HTML, CSS
* **Database:** MongoDB
* **Authentication:** Custom middleware
* **API Integration:** Delhivery

---

## 🚀 Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/smita-ejs.git
cd smita-ejs
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup environment variables

Create a `.env` file using `.env.example`:

```
PORT=3000
MONGO_URI=your_mongodb_connection
DELHIVERY_API_KEY=your_api_key
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_password
```

---

### 4. Run the server

```bash
npm start
```

Visit:

```
http://localhost:3000
```

---

## 🔐 Admin Access

Go to:

```
/admin/login
```

Login using credentials defined in `.env`.

---

## 📈 Future Improvements

* 📊 Advanced analytics dashboard (Chart.js)
* ⚡ Redis caching for performance
* 📬 Email/SMS notifications
* 📦 Order status automation
* 🌍 Multi-language support

---

## 🤝 Contributing

Contributions are welcome!
Feel free to fork the repo and submit a pull request.

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

Developed by **Smita Logistics Team**
