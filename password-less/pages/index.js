
import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import SignIn from '../components/signin/signin';

export default function Home() {
  const [value, setValue] =   useState(0);
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (event, newTabIndex) => {
    setTabIndex(newTabIndex);
  };

  useEffect(() => {
  // optional add on first load functionality 
  }, []);

  return (
    <React.Fragment>
    <Box sx={{ width: '100%', bgcolor: 'background.paper' }}>
     <Tabs value={tabIndex} onChange={handleTabChange} centered>
        <Tab label="Landing Page" />
      </Tabs>
    </Box>

<Box sx={{ padding: 2 }}>

{tabIndex === 0 && (
  <Box>
 <SignIn /> 
  </Box>
)}
</Box>
</React.Fragment>
  );
}
