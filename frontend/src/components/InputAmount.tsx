import React, { useEffect, useState } from 'react';
import { TextField, Grid } from '@mui/material';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import web3Theme from '../theme';
import { isStringNumber } from '../utils/general'

interface InputAmountProps {
  dbg?: boolean
  isOffer: boolean
  isAccept: boolean
  balance: number;
  isNew: boolean;
  disable: boolean;
  assetSelected: boolean
  resetField: boolean
  setAddAssetDisabled: React.Dispatch<React.SetStateAction<boolean>>;
  unsetResetInputAmount: () => void
  handleAddAssets: (amount: number) => void
  handleInputAmountFocused: (focused: boolean, isOffer: boolean, isAccept: boolean) => void
}

const SELECT_ASSET_TEXT = 'Select an asset'
const FLASH_WARNING_PERIOD_MSECS: number = 500
const AMOUNT_TEXT: string = 'Enter amount...'

const InputAmount: React.FC<InputAmountProps> = ({
  dbg=false,
  isOffer,
  isAccept,
  balance = 0,
  isNew = false,
  disable = true,
  assetSelected = false,
  resetField = false,
  setAddAssetDisabled,
  unsetResetInputAmount,
  handleAddAssets,
  handleInputAmountFocused
}) => {
	dbg && console.log('InputAmount:isOffer=', isOffer, ',isAccept=', isAccept)
	isOffer === isAccept && console.error('Can only have isOffer true or isAccept true')

  const [$isOffer, $setIsOffer] = useState<boolean>(isOffer)
  const [$isAccept, $setIsAccept] = useState<boolean>(isAccept)
  const [value, setValue] = useState<string>(AMOUNT_TEXT)
	const [focused, setFocused] = useState<boolean>(false)
  const [disabled, setDisabled] = useState<boolean>(disable);
  const [validatedAmount, setValidatedAmount] = useState<boolean>(false);

  //const [reset, setReset] = useState<boolean>(false);

    /*
  console.log('assetSelected=', assetSelected)
  console.log('balance=', balance)
  console.log('disabled=', disabled)
  console.log('value=', value)
  console.log('validatedAmount=', validatedAmount)
  console.log('resetField=', resetField)
  console.log('')
  */
    // Use useEffect to perform actions when `reset` state changes
  // Use useEffect to perform actions when `resetField` changes
  useEffect(() => {
    dbg && console.log('InputAmount:useEffect()')
    if (resetField) {
      dbg && console.log('InputAmount:value=', value)
      if (validatedAmount) {
        dbg && console.log('InputAmount:call handleAddAssets(', Number(value), ')')
        handleAddAssets(Number(value))
      }
      setAddAssetDisabled(true);
      setDisabled(false);
      setValidatedAmount(false);
      unsetResetInputAmount()
      setValue(AMOUNT_TEXT);
    }
  }, [resetField]); // Include `setAddAssetDisabled` as a dependency to ensure it's always up-to-date

  useEffect(() => {
    $setIsOffer(isOffer);
    $setIsAccept(isAccept);
  }, [isOffer, isAccept]);

  const handleOnClick = () => {
    dbg && console.log('handleOnClick()')
    setFocused(true)
    setValidatedAmount(false);
    handleInputAmountFocused(true, $isOffer, $isAccept)
    setAddAssetDisabled(true);
    setValue('');
    setDisabled(false);
  };

  const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dbg && console.log('handleOnChange()')
    setFocused(true)
    handleInputAmountFocused(true, $isOffer, $isAccept)
    const value = e.target.value;

    if (isNaN(Number(value))) {
      setValue('digits only');
      setTimeout(() => {
        handleOnClick();
        setValue('');
      }, FLASH_WARNING_PERIOD_MSECS);
      return; // Exit early if input is not a valid number
    }

    const number = parseFloat(value);

    if (number > balance) {
      setValue(`<= ${balance}`);
      setTimeout(() => {
        handleOnClick();
        setValue('');
        setAddAssetDisabled(true);
      }, FLASH_WARNING_PERIOD_MSECS);
    } else if (number === 0 && isNew) {
      setValue('> 0');
      setTimeout(() => {
        handleOnClick();
        setValue('');
      }, FLASH_WARNING_PERIOD_MSECS);
    } else {
      setValue(value);
      setValidatedAmount(true)
      const addAssetDisabled = 
        value === AMOUNT_TEXT ||
        value === SELECT_ASSET_TEXT ||
        value === '' ||
        (value === '0' && isNew)
        dbg && console.log('handleMouseEnter():addAssetDisabled=', addAssetDisabled)
        setAddAssetDisabled(addAssetDisabled)
    }
  };

  const handleMouseEnter = () => {
    dbg && console.log('handleMouseEnter()')
    setFocused(false)
    //handleInputAmountFocused(true, $isOffer, $isAccept)
    if (!disable  && !validatedAmount) {
      if (assetSelected) {
        const text: string = `${AMOUNT_TEXT}(available ${balance})`
        setValue(text)
      } else {
        const text: string = `${SELECT_ASSET_TEXT}`
        setValue(text)
      }
    }
    const addAssetDisabled = !isStringNumber(value)
    dbg && console.log('handleMouseEnter():value=', value, ',addAssetDisabled=', addAssetDisabled)
    setAddAssetDisabled(addAssetDisabled)
  }

  const handleMouseLeave = () => {
    dbg && console.log('handleMouseLeave()')
    setFocused(false)
    //handleInputAmountFocused(false, $isOffer, $isAccept)
    if (!disable && !validatedAmount) {
      if (assetSelected) {
        setValue(AMOUNT_TEXT)
      } else {
        setValue(SELECT_ASSET_TEXT)
      }
    }
    const addAssetDisabled = !isStringNumber(value) 
    dbg && console.log('handleMouseLeave():value=', value, ',addAssetDisabled=', addAssetDisabled)
    setAddAssetDisabled(addAssetDisabled)
  }

  const fieldStyle = {
    borderRadius: '10px',
  };

  const theme = useTheme();

  return (
    <ThemeProvider theme={web3Theme}>
      <Grid item paddingTop='1em'>
        <TextField  style={{borderRadius: '10px'}}
          disabled={disabled}
          size="small"
          fullWidth
          value={value}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onChange={handleOnChange}
          onClick={handleOnClick}
          InputProps={{
            style: fieldStyle,
          }}
        />
      </Grid>
    </ThemeProvider>
  );
};

export default InputAmount;