'use strict';

import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme();


function coerceToArrayBuffer (thing) {
  if (typeof thing === "string") {
      // base64url to base64
      thing = thing.replace(/-/g, "+").replace(/_/g, "/");

      // base64 to Uint8Array
      var str = window.atob(thing);
      var bytes = new Uint8Array(str.length);
      for (var i = 0; i < str.length; i++) {
          bytes[i] = str.charCodeAt(i);
      }
      thing = bytes;
  }

  // Array to Uint8Array
  if (Array.isArray(thing)) {
      thing = new Uint8Array(thing);
  }

  // Uint8Array to ArrayBuffer
  if (thing instanceof Uint8Array) {
      thing = thing.buffer;
  }

  // error if none of the above worked
  if (!(thing instanceof ArrayBuffer)) {
      throw new TypeError("could not coerce to ArrayBuffer");
  }

  return thing;
};

 function coerceToBase64Url (thing) {
  // Array or ArrayBuffer to Uint8Array
  if (Array.isArray(thing)) {
      thing = Uint8Array.from(thing);
  }

  if (thing instanceof ArrayBuffer) {
      thing = new Uint8Array(thing);
  }

  // Uint8Array to base64
  if (thing instanceof Uint8Array) {
      var str = "";
      var len = thing.byteLength;

      for (var i = 0; i < len; i++) {
          str += String.fromCharCode(thing[i]);
      }
      thing = window.btoa(str);
  }

  if (typeof thing !== "string") {
      throw new Error("could not coerce to string");
  }

  // base64 to base64url
  // NOTE: "=" at the end of challenge is optional, strip it off here
  thing = thing.replace(/\+/g, "-").replace(/\//g, "_").replace(/=*$/g, "");

  return thing;
};

function detectFIDOSupport() {
  if (window.PublicKeyCredential === undefined || typeof window.PublicKeyCredential !== "function") {
      alert("");
  }
}

function SignUp(props) {

  async function handleRegisterSubmit(event) {

    event.preventDefault();

    const data = new FormData(event.currentTarget);
    
    let firstName = data.get('firstName');
    let lastName = data.get('lastName');
    let email = data.get('email');
  
    // possible values: none, direct, indirect
    let attestationType = "none";
    // possible values: <empty>, platform, cross-platform
    let authenticatorAttachment = "";

    // possible values: preferred, required, discouraged
    let userVerification = "preferred";

    // possible values: true,false
    let requireResidentKey = "false";

    // send to server for registering
    let credentialOptions;

    try {
      credentialOptions = await fetchMakeCredentialOptions({ email: email, firstName: firstName, lastName: lastName });
    } catch (e) {
        console.error(e);
        alert("Something went really wrong");
        return;
    }

    if(credentialOptions == "User with this email - username already exists. Please sign in or register with different email - username")
    {
      alert("User with this email - username already exists. Please sign in or register with different email - username");
      return;
    }
    if (credentialOptions.status !== "ok") {
        alert(credentialOptions.errorMessage);
        return;
    }

    // Turn the challenge back into the accepted format of padded base64
    credentialOptions.challenge = coerceToArrayBuffer(credentialOptions.challenge);
    credentialOptions.user.id = coerceToArrayBuffer(credentialOptions.user.id);
    credentialOptions.excludeCredentials = credentialOptions.excludeCredentials.map((c) => {
        c.id = coerceToArrayBuffer(c.id);
        return c;
    });
    if (credentialOptions.authenticatorSelection.authenticatorAttachment === null) {
        credentialOptions.authenticatorSelection.authenticatorAttachment = undefined;
    }

    //https://www.w3.org/TR/webauthn-2/#sctn-sample-registration
var publicKey = {
  // The challenge is produced by the server; see the Security Considerations
  challenge: credentialOptions.challenge,

  // Relying Party:
  rp: {
    name: "dotnetcore passwordless API"
  },

  // User:
  user: {
    id: credentialOptions.user.id,
    name: credentialOptions.user.name,
    displayName: credentialOptions.user.displayName,
  },

  // This Relying Party will accept either an ES256 or RS256 credential, but
  // prefers an ES256 credential.
  pubKeyCredParams: [
    {
      type: "public-key",
      alg: -7 // "ES256" as registered in the IANA COSE Algorithms registry
    },
    {
      type: "public-key",
      alg: -257 // Value registered by this specification for "RS256"
    }
  ],

  authenticatorSelection: {
    // Try to use UV if possible. This is also the default.
    userVerification: "preferred"
  },

  timeout: 360000,  // 6 minutes
  excludeCredentials: [
    // Don’t re-register any authenticator that has one of these credentials
    {"id": Uint8Array.from(window.atob("ufJWp8YGlibm1Kd9XQBWN1WAw2jy5In2Xhon9HAqcXE="), c=>c.charCodeAt(0)), "type": "public-key"},
    {"id": Uint8Array.from(window.atob("E/e1dhZc++mIsz4f9hb6NifAzJpF1V4mEtRlIPBiWdY="), c=>c.charCodeAt(0)), "type": "public-key"}
  ],

  // Make excludeCredentials check backwards compatible with credentials registered with U2F
  extensions: {}
};

    let newCredential;
    try {
        newCredential = await navigator.credentials.create({
            publicKey: publicKey
        });
    } catch (e) {
        alert("Could not create credentials in browser." + e.message);
        return;
    }

    try {
        await registerNewCredential(newCredential);
        alert("You have registered successfully !");
        props.signUpSuccess();
    } catch (e) {
        alert("Could not register new credentials on server");
    }
}

async function fetchMakeCredentialOptions(formData) {
  let response = await fetch('http://localhost:5021/Register/Register', {
      method: 'POST',
      body: JSON.stringify(formData),
      headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
      }
  });

  let data = await response.json();
  console.log("data.Result: " + JSON.stringify(data.result));
  if(JSON.stringify(data.result) == "User with this email - username already exists. Please sign in or register with different email - username")
    {
      return null;
    }
  
  return data.result;
}
  
// This should be used to verify the auth data with the server
async function registerNewCredential(newCredential) {

  let attestationObject = new Uint8Array(newCredential.response.attestationObject);
  let clientDataJSON = new Uint8Array(newCredential.response.clientDataJSON);
  let rawId = new Uint8Array(newCredential.rawId);

  const data = {
      id: newCredential.id,
      rawId: coerceToBase64Url(rawId),
      type: newCredential.type,
      extensions: newCredential.getClientExtensionResults(),
      response: {
          AttestationObject: coerceToBase64Url(attestationObject),
          clientDataJson: coerceToBase64Url(clientDataJSON)
      }
  };

  let response;
  try {
      response = await registerCredentialWithServer(data);
  } catch (e) {
      alert(e);
      return;
  }

  // show error
  if (response.status !== "ok") {
      alert(response.errorMessage);
      return;
  }

  alert("You've registered successfully. You will now be redirected to sign in page OR you can sign in now");
  }
  
  async function registerCredentialWithServer(formData) {
    let response = await fetch('http://localhost:5021/Register/SaveCredentials', {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });

    let data = await response.json();

    return data;
}

  return (
    <ThemeProvider theme={theme}>
      <Container component="main" maxWidth="xs">
        <CssBaseline />
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
            {/* <LockOutlinedIcon /> */}
          </Avatar>
          <Typography component="h1" variant="h5">
            Sign up
          </Typography>
          <Box component="form" noValidate onSubmit={handleRegisterSubmit} sx={{ mt: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  autoComplete="given-name"
                  name="firstName"
                  required
                  fullWidth
                  id="firstName"
                  label="First Name"
                  autoFocus
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  id="lastName"
                  label="Last Name"
                  name="lastName"
                  autoComplete="family-name"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  required
                  fullWidth
                  id="email"
                  label="Email Address"
                  name="email"
                  autoComplete="email"
                />
              </Grid>
            </Grid>
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Sign Up
            </Button>
            <Button onClick={props.onSignInClicked}
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 0, mb: 2 }}
            >
              Sign In
            </Button>
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default SignUp;