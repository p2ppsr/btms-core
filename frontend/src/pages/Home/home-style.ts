import { makeStyles } from '@mui/styles'
import { Theme } from '@mui/material/styles'

const useStyles = makeStyles((theme: Theme) => ({
  title: {
    paddingTop: '5.5em'
  },
  sub_title: {
    paddingTop: '0.5em'
  },
  table_title: {
    paddingTop: '2.5em',
    paddingLeft: '2.5em'
  },
  no_tokens: {
    paddingTop: '1.5em',
    paddingBottom: '1.5em'
  },
  link: {
    textDecoration: 'none'
  },
  send_icon: {
    paddingLeft: '0.3em'
  }
}))

export default useStyles
