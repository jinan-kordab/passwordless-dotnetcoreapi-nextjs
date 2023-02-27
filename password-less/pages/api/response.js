import base64url from "base64url";
import { MongoClient } from "mongodb";
import nextSession from "next-session";

export default async function handler(request, response) {

    const getSession = nextSession();
    const session = await getSession(request, response);

    let verifyAuthenticatorAttestationResponse = (webAuthnResponse) => {
        let attestationBuffer = base64url.toBuffer(webAuthnResponse.response.attestationObject);
        let ctapMakeCredResp  = cbor.decodeAllSync(attestationBuffer)[0];
    
        let response = {'verified': false};
        if(ctapMakeCredResp.fmt === 'fido-u2f') {
            let authrDataStruct = parseMakeCredAuthData(ctapMakeCredResp.authData);
    
            if(!(authrDataStruct.flags & U2F_USER_PRESENTED))
                throw new Error('User was NOT presented durring authentication!');
    
            let clientDataHash  = hash(base64url.toBuffer(webAuthnResponse.response.clientDataJSON))
            let reservedByte    = Buffer.from([0x00]);
            let publicKey       = COSEECDHAtoPKCS(authrDataStruct.COSEPublicKey)
            let signatureBase   = Buffer.concat([reservedByte, authrDataStruct.rpIdHash, clientDataHash, authrDataStruct.credID, publicKey]);
    
            let PEMCertificate = ASN1toPEM(ctapMakeCredResp.attStmt.x5c[0]);
            let signature      = ctapMakeCredResp.attStmt.sig;
    
            response.verified = verifySignature(signature, signatureBase, PEMCertificate)
    
            if(response.verified) {
                response.authrInfo = {
                    fmt: 'fido-u2f',
                    publicKey: base64url.encode(publicKey),
                    counter: authrDataStruct.counter,
                    credID: base64url.encode(authrDataStruct.credID)
                }
            }
        }
    
        return response
    }

    let verifyAuthenticatorAssertionResponse = (webAuthnResponse, authenticators) => {
        let authr = findAuthr(webAuthnResponse.id, authenticators);
        let authenticatorData = base64url.toBuffer(webAuthnResponse.response.authenticatorData);
    
        let response = {'verified': false};
        if(authr.fmt === 'fido-u2f') {
            let authrDataStruct  = parseGetAssertAuthData(authenticatorData);
    
            if(!(authrDataStruct.flags & U2F_USER_PRESENTED))
                throw new Error('User was NOT presented durring authentication!');
    
            let clientDataHash   = hash(base64url.toBuffer(webAuthnResponse.response.clientDataJSON))
            let signatureBase    = Buffer.concat([authrDataStruct.rpIdHash, authrDataStruct.flagsBuf, authrDataStruct.counterBuf, clientDataHash]);
    
            let publicKey = ASN1toPEM(base64url.toBuffer(authr.publicKey));
            let signature = base64url.toBuffer(webAuthnResponse.response.signature);
    
            response.verified = verifySignature(signature, signatureBase, publicKey)
    
            if(response.verified) {
                if(response.counter <= authr.counter)
                    throw new Error('Authr counter did not increase!');
    
                authr.counter = authrDataStruct.counter
            }
        }
    
        return response
    }
    
    console.log("Response is: " + JSON.stringify(request.body));

    if(!request.body       || !request.body.id
        || !request.body.rawId || !request.body.response
        || !request.body.type  || request.body.type !== 'public-key' ) {
            response.json({
                'status': 'failed',
                'message': 'Response missing one or more of id/rawId/response/type fields, or type is not public-key!'
            })
    
            return
        }
    
        let webauthnResp = request.body
        let clientData   = JSON.parse(base64url.decode(webauthnResp.response.clientDataJSON));
       
        /* Check challenge... */
        if(clientData.challenge !== session.challenge) {
            response.json({
                'status': 'failed',
                'message': 'Challenges don\'t match!'
            })
        }
    
        /* ...and origin */
        if(clientData.origin !== config.origin) {
            response.json({
                'status': 'failed',
                'message': 'Origins don\'t match!'
            })
        }
    
        let result;
        if(webauthnResp.response.attestationObject !== undefined) {
            /* This is create cred */
            result = verifyAuthenticatorAttestationResponse(webauthnResp);
    
            if(result.verified) {
                database[request.session.username].authenticators.push(result.authrInfo);
                database[request.session.username].registered = true
            }
        } else if(webauthnResp.response.authenticatorData !== undefined) {
            /* This is get assertion */
            const client = await  MongoClient.connect('mongodb+srv://jinankordab:GhG2020!2019_@cluster0.nrwxdjb.mongodb.net/users?retryWrites=true&w=majority');
            const db = client.db();
            const user =  await db.collection("user").find({ email:'' + session.username + ''}).toArray();

            result = verifyAuthenticatorAssertionResponse(webauthnResp, user[0]["authenticators"]);
        } else {
            response.json({
                'status': 'failed',
                'message': 'Can not determine type of response!'
            })
        }
    
        if(result.verified) {
            session.loggedIn = true;
            response.json({ 'status': 'ok' })
        } else {
            response.json({
                'status': 'failed',
                'message': 'Can not authenticate signature!'
            })
        }
   
  }
  