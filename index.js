const express = require('express');
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()

const port = process.env.PORT || 5000;

// middleware
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send("ModoNovo is Running.....................")
})

// Verify JWT
const VerifyJwt = (req, res, next) => {
    const authorization = req.headers.authorization
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized access' });
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'Unauthorized access' });
        }
        req.decoded = decoded;
        next()
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a46jnic.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect();


        const usersCollections = client.db("modonovoDB").collection("users");

        // JWT
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        // VerifyAdmin
        const VerifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollections.findOne(query)
            if (user.role !== "Admin") {
                return res.status(401).send({ error: true, message: 'Unauthorized access' });
            }

            next()

        }


        // Users Api
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollections.findOne(query)
            if (existingUser) {
                return res.send({ message: "user already exist" })
            }
            const result = await usersCollections.insertOne(user);
            res.send(result)
        })

        // Get All Users
        app.get('/users', VerifyJwt, async (req, res) => {
            const result = await usersCollections.find().toArray()
            res.send(result)
        })


        // Admin APIs

        // Make User into Admin
        app.patch('/users/admin/:id', VerifyJwt, VerifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: "Admin"
                }
            }
            const result = await usersCollections.updateOne(query, updatedDoc)
            res.send(result)
        })
        // Convert User into instructors 
        app.patch('/users/instructors/:id', VerifyJwt, VerifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    role: "Instructor"
                }
            }
            const result = await usersCollections.updateOne(query, updatedDoc)
            res.send(result)
        })

        // Get admin
        app.get('/users/admin/:email', VerifyJwt, async (req, res) => {
            const email = req?.params?.email
            // console.log(email);

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollections.findOne(query);
            const result = { admin: user?.role === 'Admin' }
            res.send({ result: result });
        })
        // Get Instructor
        app.get('/users/instructors/:email', VerifyJwt, async (req, res) => {
            const email = req?.params?.email


            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email }
            const user = await usersCollections.findOne(query);
            const result = { instructor: user?.role === 'Instructor' }

            res.send({ result: result });
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`modonovo is runnning at port :${port}`);
})