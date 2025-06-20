const express=require('express');
const app=express();
const mysql=require('mysql');
const path=require("path");
const location=path.join(__dirname,"./public");
app.use(express.urlencoded({ extended: true }));
app.use(express.static(location));
app.set("view engine","hbs");


app.get('/Autoentry',(req,res)=>{
    res.render("Autoentry");
});
const db=mysql.createConnection({
    host:"localhost",
    user:"root",
    password:"",
    database:"booking"
});
db.connect((err)=>{
    if(err)console.log("Your database not connected",);
    else console.log("Database connected");
})
app.get('/', (req, res) => {
  res.render('Index'); // we’ll create home.hbs
});

app.post('/search-area', (req, res) => {
  const { area } = req.body;

  const sql = "SELECT * FROM autoentry WHERE Area LIKE ?";
  db.query(sql, [`%${area}%`], (err, results) => {
    if (err) {
      console.error("Search error:", err);
      return res.render('Index', { message: 'Error while searching.' });
    }

    if (results.length === 0) {
      return res.render('Index', { message: 'No autos found for this area.' });
    }

    res.render('Index', { results, searchedArea: area });
  });
});

app.get('/Booking', (req, res) => {
    const { autonumber } = req.query; 
    res.render('Home', { autonumber }); 
});
const twilio = require('twilio');
const accountSid = 'AC0d2fc4f6d13f60591563578d8ed2241a'; 
const authToken = '494bae0369a9e9ab9f144d191f138a3c';
const client = twilio(accountSid, authToken);

app.post('/book', (req, res) => {
    const { name, from, to, phone, time, autonumber } = req.body;

    const sql = 'INSERT INTO autobooking(`Name`, `From`, `To`, `Phone number`, `bookingtime`,`autonumber`) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, from, to, phone, time, autonumber], (err, result) => {
        if (err) {
            console.error("Error inserting data:", err);
            return res.send("❌ Failed to book.");
        }

        const driverSql = "SELECT `phonenumber`, `name` FROM autoentry WHERE `autonumber` = ?";
        db.query(driverSql, [autonumber], (err2, driverResults) => {
            if (err2 || driverResults.length === 0) {
                console.error("Driver fetch error:", err2);
                return res.send("✅ Booking saved but driver not found.");
            }

            const driverPhone = driverResults[0].phonenumber;
            const driverName = driverResults[0].name;
            const fullPhone = `+91${driverPhone}`;

            // ✅ WhatsApp message
            client.messages.create({
                from: 'whatsapp:+14155238886',
                to: `whatsapp:${fullPhone}`,
                body: `🛺 Hello ${driverName},\nYou have a new booking:\nCustomer: ${name}\nFrom: ${from}\nTo: ${to}\nPhone: ${phone}\nTime: ${time}`
            }).then(message => {
                console.log("WhatsApp sent:", message.sid);
            }).catch(err => {
                console.error("WhatsApp error:", err.message);
            });

            // ✅ Voice call using TwiML
            const voiceMessage = `Hello ${driverName}, you have a new booking from ${from} to ${to} at ${time}. Passenger name is ${name}.`;

            client.calls
                .create({
                    twiml: `<Response><Say>${voiceMessage}</Say></Response>`,
                    to: fullPhone,
                    from: '+15017122661' // Use your Twilio voice-enabled number
                })
                .then(call => {
                    console.log("Call initiated:", call.sid);
                    res.send("✅ Booking successful! WhatsApp & Call alert sent.");
                })
                .catch(err => {
                    console.error("Call failed:", err.message);
                    res.send("✅ Booking saved. WhatsApp sent, The driver will call you in a few seconds.  but call failed.I will update very soon");
                });
        });
    });
});


app.post('/autobooking', (req, res) => {
    const { name, autono,phone, address,area } = req.body;

    const checkSql = "SELECT * FROM autoentry WHERE `autonumber` = ? AND `phonenumber` = ?";
    db.query(checkSql, [autono,phone], (err, results) => {
        if (err) {
            console.error("Check failed:", err);
            return res.render("Autoentry", { message: "Error checking existing records." });
        }

        if (results.length > 0) {
            // Already exists
            return res.render("Autoentry", { message: "❌ This auto number and phone is already registered." });
        }

        // Not duplicate, insert now
        const insertSql = "INSERT INTO autoentry (`name`, `autonumber`,`phonenumber`, `Address`,`Area`) VALUES (?, ?, ?, ?, ?)";
        db.query(insertSql, [name,autono,phone,address,area], (err2, result) => {
            if (err2) {
                console.error("Insert failed:", err2);
                return res.render("Autoentry", { message: "❌ Failed to add auto." });
            }

            res.render("Autoentry", { message: "✅ Auto added successfully!" });
        });
    });
});

app.listen(5000,()=>{
    console.log("start server");
});