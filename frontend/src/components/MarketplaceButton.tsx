import React, { useEffect, useState } from 'react';
import { Button, Grid, ThemeProvider, useTheme } from '@mui/material';
import { styled } from '@mui/system';
import web3Theme from '../theme';

interface MarketplaceButtonProps {
  dbg?: boolean
  isOffer: boolean
  isAccept: boolean
  text: string;
  handleOnMouseEnterConfirmed?: () => void
  handleOnMouseLeaveConfirmed?: () => void
  handleOnBlurConfirmed?: () => void
  handleOnClickConfirmed?: () => void
  disable: boolean;
}
const MarketplaceButton: React.FC<MarketplaceButtonProps> = ({
  dbg=false,
	isOffer,
	isAccept,
  text,
  handleOnMouseEnterConfirmed,
  handleOnMouseLeaveConfirmed,
  handleOnBlurConfirmed,
  handleOnClickConfirmed,
  disable
}) => {

const [$isOffer, $setIsOffer] = useState<boolean>(isOffer)
const [$isAccept, $setIsAccept] = useState<boolean>(isAccept)

useEffect(() => {
  $setIsOffer(isOffer);
  $setIsAccept(isAccept);
}, [isOffer, isAccept]);

const StyledButton = styled(Button)(({ theme }) => ({
  // Apply styles for the button text
  '& .MuiButton-label': {
    color: '#888', // Grey text color
    opacity: 0.5,
    },
    // Apply styles for the button itself
    backgroundColor: '#fff', // White background color
    color: '#888', // Initial grey text color
    '&:hover': {
      color: '#000', // Black text color on hover
      opacity: 1.0,
      backgroundColor: '#fff', // Maintain white background on hover
    },
  }));

  const DisabledButton = styled(Button)(({ theme }) => ({
    // Apply styles for the disabled button
    backgroundColor: theme.palette.action.disabledBackground,
    color: theme.palette.action.disabled,
    '&:hover': {
      backgroundColor: theme.palette.action.disabledBackground,
    },
  }));

  const handleOnMouseEnter = () => {
		dbg && console.log('handleOnMouseEnter()')
	  handleOnMouseEnterConfirmed && handleOnMouseEnterConfirmed();
	};

  const handleOnMouseLeave = () => {
		dbg && console.log('handleOnMouseLeave()')
	  handleOnMouseLeaveConfirmed && handleOnMouseLeaveConfirmed();
	};

  const handleOnBlur = () => {
		dbg && console.log('handleOnBlur()')
	  handleOnBlurConfirmed && handleOnBlurConfirmed();
	};

  const handleOnClick = () => {
		dbg && console.log('handleOnClick()')
	  handleOnClickConfirmed && handleOnClickConfirmed();
	};

  const theme = useTheme();

  dbg && console.log('MarketplaceButton(): disable=', disable);

  return (
    <ThemeProvider theme={web3Theme}>
    <Grid item paddingTop='1em'>
      {disable ? (
          // Render disabled button if conditional is true
          <DisabledButton
            onMouseEnter={handleOnMouseEnter}
            onMouseLeave={handleOnMouseLeave}
            onBlur={handleOnBlur}
            onClick={handleOnClick}
            disabled
          >
            {text}
          </DisabledButton>
        ) : (
          // Render styled button otherwise
          <StyledButton
            onMouseEnter={handleOnMouseEnter}
            onMouseLeave={handleOnMouseLeave}
            onBlur={handleOnBlur}
            onClick={handleOnClick}
          >
            {text}
          </StyledButton>
        )}
    </Grid>
    </ThemeProvider>
  );
};

export default MarketplaceButton;
