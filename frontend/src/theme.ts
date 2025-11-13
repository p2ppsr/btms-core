import { createTheme } from '@mui/material/styles';

// Define a custom theme with dark mode configuration
const web3Theme = createTheme({
  palette: {
    mode: 'dark', // Use a dark theme as a base
    primary: {
      main: '#fff', // white color for primary elements
    },
    secondary: {
      main: '#7e57c2', // Soft purple for secondary elements
    },
    error: {
      main: '#ff3860', // Vibrant red for errors
    },
    background: {
      default: '#121212', // Dark background color
      paper: '#242424', // Slightly lighter shade for paper elements
    },
    text: {
      primary: '#ffffff', // White text color
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', // Modern, clean font
    h2: {
      fontWeight: 700, // Bold headers
    },
    button: {
      textTransform: 'none', // Buttons with regular casing
      borderRadius: '15px', 
    },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#ffffff', // Change focused border color to white
            },
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '15px', // Maximum radius for curved buttons
          whiteSpace: 'nowrap'
        },
      },
      variants: [
        {
          props: { variant: 'contained', color: 'primary' },
          style: {
            color: '#000000', // Black text for dark mode contained buttons
            backgroundColor: '#ffffff', // White background for dark mode contained buttons
            '&:hover': {
              backgroundColor: '#e0e0e0', // Light gray background on hover for dark mode
            },
          },
        },
        {
          props: { variant: 'contained', color: 'secondary' },
          style: {
            color: '#ffffff', // White text for dark mode secondary contained buttons
            backgroundColor: '#7e57c2',
            '&:hover': {
              backgroundColor: '#9575cd', // Lighter purple background on hover for dark mode
            },
          },
        },
        {
          props: { variant: 'contained' },
          style: {
            color: '#000000', // Black text for dark mode default contained buttons
            backgroundColor: '#424242', // Darker background for dark mode default contained buttons
            '&:hover': {
              backgroundColor: '#616161', // Lighter gray background on hover for dark mode
            },
          },
        },
      ],
    },
  },
});

export default web3Theme;
