const express = require('express')
const app = express()
const cors = require('cors');
const admin = require("firebase-admin");
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;

const port = process.env.PORT || 5000;


// the-niketan-firebase-adminsdk.json

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// middleware
app.use(cors());
app.use(express.json());

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@traversymedia.a77qb.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@traversymedia.a77qb.mongodb.net/?retryWrites=true&w=majority`

// mongodb+srv://<username>:<password>@traversymedia.a77qb.mongodb.net/?retryWrites=true&w=majority

// const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });


async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}


async function run() {
    try {
        await client.connect();
        console.log('database connected successfully');
        const database = client.db('the_niketan');
        const apartmentsCollections = database.collection('apartments');
        const bookingCollections = database.collection('bookings');
        const usersCollections = database.collection('users');
        const reviewCollections = database.collection('reviews');

        // Store A New Apartment in Server
        app.post('/apartments', async(req, res) => {
            const apartment = req.body;
            const result = await apartmentsCollections.insertOne(apartment);
            console.log(result);
            res.json(result);
        });

        // Load all apartments to frontend from the Server
        app.get('/apartments', verifyToken, async (req, res) =>{
            const cursor = apartmentsCollections.find({});
            const apartments = await cursor.toArray();
            res.json(apartments);
        });

        // Load single apartment to frontend from the Server
        app.get('/apartments/:id', async (req, res) =>{
            const id = req.params.id;
            console.log('Getting the apartment id: ', id);
            const query = {_id: ObjectId(id)};
            const apartment = await apartmentsCollections.findOne(query);
            console.log(apartment);
            res.json(apartment);
        });

        // Store A New Apartment Booking in Server
        app.post('/bookings', async(req, res) => {
            const booking = req.body;
            const result = await bookingCollections.insertOne(booking);
            console.log(result);
            res.json(result);
        });

        // Delete An Apartment
        app.delete('/apartments/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            // console.log(query);
            const result = await apartmentsCollections.deleteOne(query);
      
            console.log('deleting apartment with id ', result);

            res.json(result);
          })

        // Load all bookings to frontend from the Server
        app.get('/allbookings', async (req, res) =>{
            const cursor = bookingCollections.find({});
            const bookings = await cursor.toArray();
            res.json(bookings);
        });

        // Load all bookings of a User to frontend from the Server
        app.get('/bookings', async (req, res) =>{
            const email = req.query.email;
            const query = {email: email};
            const cursor = bookingCollections.find(query);
            const bookings = await cursor.toArray();
            res.json(bookings);
        });

        // Delete a Booking
        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            // console.log(query);
            const result = await bookingCollections.deleteOne(query);
      
            console.log('deleting booking with id ', result);

            res.json(result);
          })

        // Update a Booking 
        app.put('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const updatedBooking = req.body;
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    status:updatedBooking.status
                },
            };
            const result = await bookingCollections.updateOne(filter, updateDoc, options);

            console.log(result);

            res.json(result);
          })

        // Store users information to the server
        app.post('/users', async(req, res) =>{
            const user = req.body;
            const result = await usersCollections.insertOne(user);
            console.log(result);
            res.json(result);
        })

        // Store (Upsert) users information from Google Login to the server
        app.put('/users', async(req, res)=>{
            const user = req.body;
            const filter = {email: user.email};
            const options = {upsert: true};
            const updateDoc = {$set: user};
            const result = await usersCollections.updateOne(filter, updateDoc, options);
            res.json(result);
        })

        // Make Admin
        // app.put('/users/admin', async(req, res)=>{
        //     const user = req.body;
        //     const filter = {email: user.email};
        //     const updateDoc = {$set: {role: 'admin'}};
        //     const result = await usersCollections.updateOne(filter, updateDoc);
        //     res.json(result);
        // })
        app.put('/users/admin', verifyToken, async(req, res)=>{
            const user = req.body;
            const requester = req.decodedEmail;

            if(requester){
                const requesterAccount = await usersCollections.findOne({email: requester});
                if(requesterAccount.role === 'admin'){
                    const filter = {email: user.email};
                    const updateDoc = {$set: {role: 'admin'}};
                    const result = await usersCollections.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'You do not have access to make admin' })
            }
            
        })

        // isAdmin 
        app.get('/users/:email', async(req, res)=>{
            const email = req.params.email;
            const query = {email: email};
            const user = await usersCollections.findOne(query);
            let isAdmin = false;
            if(user?.role === 'admin'){
                isAdmin = true;
            }
            res.json({admin: isAdmin});
        })

        // Give reviews 
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewCollections.insertOne(review);
            res.json(result);
        });

        // Load Reviews
        app.get('/reviews', async (req, res) => {
            const cursor = reviewCollections.find({});
            const result = await cursor.toArray();
            res.json(result);
        });
    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello from the Niketan Server!')
})

app.listen(port, () => {
    console.log(`listening at ${port}`)
})