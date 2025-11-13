import { makeStyles } from '@mui/styles'
import { Theme } from '@mui/material/styles'

const useStyles = makeStyles((theme: Theme) => ({
  title: {
    paddingTop: '10em'
  },
  sub_title: {
    paddingTop: '2.5em'
  },
  form: {
    paddingTop: '3.5em',
    rowGap: '1em'
  },
  button: {
    paddingTop: '1.5em',
    paddingBottom: '1.5em'
  },
  back_icon: {
    paddingRight: '0.5em'
  },
  photo_preview_img: {
    maxWidth: '16em',
    maxHeight: '16em',
    borderRadius: '2em'
  },
  photo_container: {
    width: '16em',
    height: '16em',
    borderRadius: '2em !important',
    display: 'grid',
    alignItems: 'center',
    justifyContent: 'center'
  },
  photo_preview: {
    position: 'relative'
  }
}))

export default useStyles
