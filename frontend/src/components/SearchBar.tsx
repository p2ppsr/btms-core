import React, { useEffect, useState } from 'react';
import { TextField, IconButton, InputAdornment } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import web3Theme from '../theme';

interface SearchBarProps {
	dbg?: boolean
	isOffer: boolean
	isAccept: boolean
	handleSearchBar: (text: string) => void
  handleClearSearchBar: () => void;
	handleSearchBarFocused: (focused: boolean, isOffer: boolean, isAccept: boolean) => void
}

const fieldStyle = {
  borderRadius: '10px',
}

const SearchBar: React.FC<SearchBarProps> = ({
	dbg=false,
	isOffer,
	isAccept,
	handleSearchBar,
  handleClearSearchBar,
	handleSearchBarFocused
}) => {
	dbg && console.log('SearchBar:isOffer=', isOffer, ',isAccept=', isAccept)
	isOffer === isAccept && console.error('Can only have isOffer true or isAccept true')

	const [$isOffer, $setIsOffer] = useState<boolean>(isOffer)
  const [$isAccept, $setIsAccept] = useState<boolean>(isAccept)
  const [text, setText] = useState<string>('');
	const [focused, setFocused] = useState<boolean>(false)

  useEffect(() => {
    $setIsOffer(isOffer);
    $setIsAccept(isAccept);
  }, [isOffer, isAccept]);

  const handleOnChange = (text: string) => {
		dbg && console.log('SearchBar:handleOnChange():text:', text, ',$isOffer=', $isOffer, ',$isAccept=', $isAccept)
		setFocused(true)
	  handleSearchBarFocused(true, $isOffer, $isAccept); // Call the parent handler to update the search field
		setText(text);
    handleSearchBar(text); // Call the parent handler to update the search field
  };

	const handleOnFocus = () => {
		dbg && console.log('SearchBar:handleOnFocus():$isOffer=', $isOffer, ',$isAccept=', $isAccept)
    setFocused(true);
	  handleSearchBarFocused(true, $isOffer, $isAccept); // Call the parent handler to update the search field
	};

	const handleOnBlur = () => {
		dbg && console.log('SearchBar:handleOnClick():$isOffer=', $isOffer, ',$isAccept=', $isAccept)
    setFocused(false);
	  handleSearchBarFocused(false, $isOffer, $isAccept); // Call the parent handler to update the search field
	};

	const handleOnMouseEnter = () => {
		dbg && console.log('SearchBar:handleOnMouseEnter():$isOffer=', $isOffer, ',$isAccept=', $isAccept)
    setFocused(true);
	  //handleSearchBarFocused(true, $isOffer, $isAccept); // Call the parent handler to update the search field
	};

	const handleOnMouseLeave = () => {
		dbg && console.log('SearchBar:handleOnMouseLeave():$isOffer=', $isOffer, ',$isAccept=', $isAccept)
    setFocused(false);
	  //handleSearchBarFocused(true, $isOffer, $isAccept); // Call the parent handler to update the search field
	};

	const handleOnClick = () => {
		dbg && console.log('SearchBar:handleOnClick():$isOffer=', $isOffer, ',$isAccept=', $isAccept)
    setFocused(true);
	  handleSearchBarFocused(true, $isOffer, $isAccept); // Call the parent handler to update the search field
	};

  const handleOnClickClose = () => {
		dbg && console.log('SearchBar:handleOnClickClose()')
	  handleSearchBarFocused(true, $isOffer, $isAccept); // Call the parent handler to update the search field
		setText('');
    handleClearSearchBar();
  };

	const theme = useTheme();

	return (
    <ThemeProvider theme={web3Theme}>
			<TextField
				size='small'
				variant='outlined'
				fullWidth
				value={text}
				onMouseEnter={handleOnMouseEnter}
				onMouseLeave={handleOnMouseLeave}
				onClick={handleOnClick}
				InputProps={{
					style: fieldStyle,
					startAdornment: (
						<InputAdornment position='start'>
							{!focused && text === '' && (<IconButton  size='small' disabled={!focused}>
								<SearchIcon/>
							</IconButton>)}
						</InputAdornment>
					),
					endAdornment: (
						<InputAdornment position='end'>
							{text && (<IconButton onClick={handleOnClickClose} size='small' disabled={!text}>
								<CloseIcon />
							</IconButton>)}
						</InputAdornment>
					),
				}}
				onFocus={() => handleOnFocus}
				onBlur={() => handleOnBlur}
				onChange={(e) => handleOnChange(e.target.value)}
			/>
		</ThemeProvider>
  );
};

export default SearchBar;
