import React, { useState } from "react";
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import SignUp from '../signup/signup';

const theme = createTheme();
// Base64 to ArrayBuffer
function bufferDecode(value) {
  return Uint8Array.from(window.atob(value), c => c.charCodeAt(0));
}

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

function SignIn() {

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [signUp, setSignUp] = useState(true);
  const [signIn, setSignIn] = useState(false);
  const [userInfo, setUserInfo] = useState("");

  async function handleSignInSubmit(event) {

    event.preventDefault();

    const data = new FormData(event.currentTarget);

    let _username = data.get('email');

    let publicKeyOptions;

    try {
      publicKeyOptions = await fetchMakeSignInOptions({ username: _username });
    } catch (e) {
        alert("Request to server failed");
        return;
    }
    if (publicKeyOptions.status !== "ok") {
        return;
    }

    const challenge = publicKeyOptions.challenge.replace(/-/g, "+").replace(/_/g, "/");
    publicKeyOptions.challenge = bufferDecode(challenge);
    let credId;
    publicKeyOptions.allowCredentials.forEach(function (listItem) {
        var fixedId = listItem.id.replace(/\_/g, "/").replace(/\-/g, "+");
      listItem.id = bufferDecode(fixedId);
      credId = listItem.id;
    });

    var options = {
      // The challenge is produced by the server; see the Security Considerations
      challenge: publicKeyOptions.challenge,
      timeout: 120000,  // 2 minutes
      allowCredentials: [{ type: "public-key", id: credId }]
    };

    // ask browser for credentials (browser will ask connected authenticators)
    let credential;
    try {
      credential = await navigator.credentials.get({ publicKey:  options  });
      try {
            await verifyAssertionWithServer(credential);
        } catch (e) {
            alert("Could not verify assertion " + e.message);
        }
    } catch (err) {
        alert(err.message ? err.message : err);
    }
}

async function fetchMakeSignInOptions(formData) {
  let response = await fetch('http://localhost:5021/Register/Login', {
      method: 'POST',
      body: JSON.stringify(formData),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
  });

  let data   = await response.json();
  
  if (data.result === "Please register first") {
    alert(data.result);
    console.log("Please register first");
    handleSignUpClicked();
    return false;

  }
  else {
    console.log("INSIDE ELSE");
    return data.result;
  }
}
  
  async function verifyAssertionWithServer(assertedCredential) {
    console.log("assertedCredential.id "  + assertedCredential.id);
  let authData = new Uint8Array(assertedCredential.response.authenticatorData);
  let clientDataJSON = new Uint8Array(assertedCredential.response.clientDataJSON);
  let rawId = new Uint8Array(assertedCredential.rawId);
  let sig = new Uint8Array(assertedCredential.response.signature);
  const data = {
      id: assertedCredential.id,
      rawId: coerceToBase64Url(rawId),
      type: assertedCredential.type,
      extensions: assertedCredential.getClientExtensionResults(),
      response: {
          authenticatorData: coerceToBase64Url(authData),
          clientDataJson: coerceToBase64Url(clientDataJSON),
          signature: coerceToBase64Url(sig)
      }
    };
    
  let response;
  try {
      let res = await fetch("http://localhost:5021/Register/MakeAssertion", {
          method: 'POST',
        body: JSON.stringify(data), 
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

    response = await res.json();
    
    console.log(JSON.stringify(response));
  } catch (e) {
      alert("Request to server failed", e);
      throw e;
  }
  
  let trimmedStatus = response.status.toString().replace(/"/g,'');
  if (trimmedStatus !== "ok") {
      alert("ERROR on SIGN IN");
      alert(response.errorMessage);
      return;
  }
  else
  {
    setIsAuthenticated(true);
    setUserInfo(response.firstName.toString().replace(/"/g,'') + " " + response.lastName.toString().replace(/"/g,''));
  }

}

function handleSignInClicked()
{
  setSignIn(true);
  setSignUp(false);
}
function handleSignUpClicked()
{
  setSignIn(false);
  setSignUp(true);
}
function handleSignUpSuccess()
{
  setSignIn(true);
  setSignUp(false);
}

  return (
    <ThemeProvider theme={theme}>
      <Container component="main" maxWidth="xs">
        <CssBaseline />
        {signUp && <SignUp signUpSuccess={handleSignUpSuccess} onSignInClicked={handleSignInClicked}/>}
        
        {signIn && 
        !isAuthenticated &&
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
            Sign in
          </Typography>
          <Box component="form" noValidate onSubmit={handleSignInSubmit} sx={{ mt: 3 }}>
            <Grid container spacing={2}>
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
              Sign In
            </Button>
            <Button onClick={handleSignUpClicked}
              type="button"
              fullWidth
              variant="contained"
              sx={{ mt: 0, mb: 2 }}
            >
              Sign Up
            </Button>
          </Box>
        </Box>
        
        }
        {isAuthenticated && <div>Welcome <h2>{userInfo}</h2></div>}
        
      </Container>
    </ThemeProvider>
  );
}

export default SignIn;