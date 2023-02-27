import { MongoClient } from "mongodb";
import crypto from "crypto";
import base64url from "base64url";
import nextSession from "next-session";

export default async function handler(request, response) {
    //console.log(request);

//verify the returned response

    if(!request.body.dta || !request.body.dta.firstName || !request.body.dta.lastName || !request.body.dta.email) {
        response.json({
            'status': 'failed',
            'message': 'Request missing name or username field!'
        })

        return;
    }

    let fisrstname = request.body.dta.firstName;
    let lastname     = request.body.dta.lastName;
    let emial = request.body.dta.email;

//verify if the user who is trying to register already exists in MongoDb
console.log("BEFORE QUERYING MONGO");
    const client = await  MongoClient.connect('mongodb+srv://jinankordab:GhG2020!2019_@cluster0.nrwxdjb.mongodb.net/users?retryWrites=true&w=majority');
    const db = client.db();
    const user =  await db.collection("user").find({ email:'' + emial + ''}).toArray();
    console.log("AFTER QUERYING MONGO");
//Already exists
    if(user[0] != null) {
        response.json({
            'status': 'failed',
            'message': `Username with email ${emial} already exists`
        })

        return;
    }

//Does not exist - add/register new user
  
    let randomBase64URLBuffer = (len) => {
        len = len || 32;
    
        let buff = crypto.randomBytes(len);
    
        return base64url(buff);
    }

  const uID = randomBase64URLBuffer();
  await db.collection('user').insertOne({firstName:fisrstname, lastName:lastname, email:emial, registered:false, id:uID,authenticators:[]});
  client.close(); 

    // database[username] = {
    //     'name': name,
    //     'registered': false,
    //     'id': utils.randomBase64URLBuffer(),
    //     'authenticators': []
    // }

    const displayName = fisrstname + " " + lastname;
    let generateServerMakeCredRequest = (emial, displayName, uID) => {
        return {
            challenge: randomBase64URLBuffer(32),
            rp: {
                name: "Passwordless Demo",
                id: "localhost",  
            },
    
            user: {
                id: uID,
                name: emial,
                displayName: displayName
            },
            pubKeyCredParams: [{alg: -7, type: "public-key"},{alg: -257, type: "public-key"}],  
            excludeCredentials: [{  
                id: randomBase64URLBuffer(32),  
                type: 'public-key',  
                transports: ['internal'],  
              }],
              authenticatorSelection: {  
                authenticatorAttachment: "platform",  
                requireResidentKey: true,  
              } 
        }
    }

    let challengeMakeCred    = generateServerMakeCredRequest(emial, displayName, uID);
    challengeMakeCred.status = 'ok';

    const getSession = nextSession();
    const session = await getSession(request, response);
    session.challenge = challengeMakeCred.challenge;
    session.username  = emial;

    response.json(challengeMakeCred);

   
  }
  