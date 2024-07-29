const express = require('express');
const {MongoClient}  = require('mongodb');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Connection url and database Name
const uri = "mongodb+srv://vishukac:Vishukac22@cluster0.d4gksa4.mongodb.net/transactionsDB";
const dbName = 'transactionsDB'; 
const collectionName = "productTransactions";

const client = new MongoClient(uri); 



async function insertDataIfNotExists(collection,data){
    for(const item of data){
        const existingItem = await collection.findOne({id: item.id});
        if(!existingItem){
            await collection.insertOne(item);
        }
    }
}

// Connect to MongoDB and create a collection
async function createDatabase() {
    try {

        const apiUrl =" https://s3.amazonaws.com/roxiler.com/product_transaction.json";
        const response = await axios.get(apiUrl);
        const data = response.data;
    
      await client.connect();
      const db = client.db(dbName);

      const collection = db.collection(collectionName);

      await insertDataIfNotExists(collection, data);


      console.log("doc inserted  " ); 
    } catch (err) {
    
      console.error('Error inserting data : ' , err);
    } 
}

createDatabase().catch(console.error);


// To connect Database
async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected successfully to MongoDB");
    return client.db(dbName);
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    throw err; // Re-throw the error after logging it
  }
}
 

app.get("/transactions", async (req, res) => {
  
  const { search, page, perPage, month } = req.query;
  const pageNum = parseInt(page, 10);
  const perPageNum = parseInt(perPage, 10);

  try { 
    const db = await connectToDatabase();
    const collection = db.collection(collectionName);

    const query = search
      ? {
          $and: [
            {
              $or: [
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { price: { $regex: search, $options: "i" } },
              ],
            },
            month
              ? {
                  $expr: {
                    $eq: [
                      {
                        $month: {
                          $dateFromString: { dateString: "$dateOfSale" },
                        },
                      },
                      parseInt(month, 10),
                    ],
                  },
                }
              : {},
          ],
        }
      : month
      ? {
          $expr: {
            $eq: [
              { $month: { $dateFromString: { dateString: "$dateOfSale" } } },
              parseInt(month, 10),
            ],
          },
        }
      : {};

    const totalRecords = await collection.countDocuments(query);
    const transactions = await collection
      .find(query)
      .skip((pageNum - 1) * perPageNum)
      .limit(perPageNum)
      .toArray();

    res.json({
      totalRecords,
      transactions,
      page: pageNum,
      perPage: perPageNum,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }  
});

 
// api to handle statistic req
app.get("/statistics" , async (req, res) =>{
  try {
    const month = parseInt(req.query.month, 10);
    if (!month || month < 1 || month > 12) {
      return res.status(400).send("Invalid month");
    }

    const db = await connectToDatabase();
    const collection = db.collection(collectionName);

    const pipeline = [
      {
        $addFields: {
          dateAsDate: { $dateFromString: { dateString: "$dateOfSale" } },
        },
      },
      {
        $match: {
          $expr: { $eq: [{ $month: "$dateAsDate" }, month] },
        },
      },
      {
        $group: {
          _id: null,
          totalSale: {
            $sum: { $cond: [{ $eq: ["$sold", true] }, "$price", 0] },
          },
          totalSoldItems: { $sum: { $cond: [{ $eq: ["$sold", true] }, 1, 0] } },
          totalNotSoldItems: {
            $sum: { $cond: [{ $eq: ["$sold", false] }, 1, 0] },
          },
        },
      },
    ];
    const result = await collection.aggregate(pipeline).toArray(); 
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }  
});

 
/// API to get bar chart data for a given month 
 
app.get("/chart-data", async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10);
    if (!month || month < 1 || month > 12) {
      return res.status(400).send("Invalid month");
    }

     await client.connect();
     const db = await connectToDatabase();
     const collection = db.collection(collectionName);

    const pipeline = [
      {
        $addFields: {
          dateAsDate: { $dateFromString: { dateString: "$dateOfSale" } },
        },
      },
      {
        $match: {
          $expr: { $eq: [{ $month: "$dateAsDate" }, month] },
        },
      },
      {
        $bucket: {
          groupBy: "$price",
          boundaries: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
          default: "901-above",
          output: {
            count: { $sum: 1 },
          },
        },
      },
    ];
    const result = await collection.aggregate(pipeline).toArray();

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
});
 
const PORT = process.env.PORT || 2222;
app.listen(PORT , () =>{
    console.log(`server is running on port ${PORT}`);
});