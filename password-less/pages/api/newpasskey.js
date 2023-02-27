import { MongoClient } from "mongodb";

function testIntBuffer(n) {
    return new ArrayBuffer(Int32Array.BYTES_PER_ELEMENT * n);
  }
  
  function fillIntBuffer(buffer, endInt) {
    for (var i = 0; i <= endInt; i++) {
      buffer[i] = i;
    }
    return buffer;
  }


export default async function handler(req, res) {

    if(req.method === "GET")
    {
        const existingUserEmail = req.query["email"];
        console.log("BackEnd User Email Passed:  " + existingUserEmail);
        //Server side validation
        if(!existingUserEmail || !existingUserEmail.includes('@'))
        {
            res.status(422).json({message:'Email address not valid!'});
            return ;
        }

        const client = await  MongoClient.connect('mongodb+srv://jinankordab:GhG2020!2019_@cluster0.nrwxdjb.mongodb.net/users?retryWrites=true&w=majority');
        const db = client.db();
        const query = { email:'' + existingUserEmail + ''};
        const user =  await db.collection("user").find({ email:'' + existingUserEmail + ''}).toArray();
        console.log("user[0]:" + JSON.stringify(user[0]["_id"]));
        var a = testIntBuffer(4);
        var b = new Int32Array(a);
        fillIntBuffer(b, 4);
         res.json([
            user,b
         ]
        );
    }
  }
  