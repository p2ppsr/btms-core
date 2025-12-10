// frontend/src/pages/Mint/index.tsx
import React, { useState, useRef } from 'react'
import { Container, Typography, Grid, Button, TextField, Paper, IconButton, CircularProgress, Backdrop } from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import useStyles from './mint-style'

import { btms } from '../../btms/index'

interface MintProps {
  history: {
    push: (path: string) => void
  }
}

const Mint: React.FC<MintProps> = ({ history }) => {
  const classes = useStyles()
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [description, setDescription] = useState('')
  const [photoURL, setPhotoURL] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handlePhotoClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      const urlReader = new FileReader()
      urlReader.onload = () => {
        setPhotoURL(urlReader.result as string)
      }
      urlReader.readAsDataURL(file)
    }
  }

  const mint = async () => {
    const traceId = `mint_${Date.now()}`
    setLoading(true)
    try {
      console.log(`[${traceId}] Mint button clicked with`, {
        name,
        quantity,
        descriptionLen: description.length,
        hasImage: !!photoURL
      })

      if (name.trim() === '') {
        toast.error('Enter a name for the token!')
        console.warn(`[${traceId}] Aborting: name missing`)
        return
      }
      if (quantity.trim() === '' || Number.isNaN(Number(quantity))) {
        toast.error('Enter a quantity for the max number of tokens!')
        console.warn(`[${traceId}] Aborting: quantity missing or NaN`, {
          quantity
        })
        return
      }
      if (description.trim() === '') {
        toast.error('Enter a description for the token!')
        console.warn(`[${traceId}] Aborting: description missing`)
        return
      }

      const amount = Number(quantity)
      console.log(`[${traceId}] Calling btms.issue(...)`, {
        amount,
        name,
        description,
        hasImage: !!photoURL
      })
      const res = await btms.issue(
        Number(quantity),
        name,
        name,
        JSON.stringify({
          description,
          image: photoURL ?? null
        })
      )

      console.log(`[${traceId}] btms.issue(...) returned`, res)

      toast.success(`Issued ${quantity} ${name} successfully!`)
      history.push('/')
    } catch (err: any) {
      console.error('[mint] error during mint', err)
      toast.error(err?.message || 'Something went wrong while minting.')
    } finally {
      console.log(`[${traceId}] Mint flow done (success or fail)`)
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Full-screen loading overlay */}
      <Backdrop
        sx={{
          color: '#fff',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          flexDirection: 'column',
          gap: 2
        }}
        open={loading}
      >
        <CircularProgress color="inherit" size={48} />
        <Typography variant="h6">Issuing asset on blockchain...</Typography>
        <Typography variant="body2">This may take a moment</Typography>
      </Backdrop>

      <Container
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr'
        }}
      >
        <Grid container>
          <Grid item className={classes.button}>
            <Button component={Link} to="/" color="secondary">
              <ArrowBackIosNewIcon className={classes.back_icon} /> My Assets
            </Button>
          </Grid>
        </Grid>

        <Grid
          container
          sx={{
            display: 'grid',
            gridColumn: '2'
          }}
        >
          <Grid container>
            <Grid item className={classes.title}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                Issue New Asset
              </Typography>
            </Grid>

            <Grid item container direction="column" className={classes.sub_title}>
              {/* Token name */}
              <Grid item container direction="column" className={classes.form}>
                <Grid item>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Asset Name
                  </Typography>
                </Grid>
                <Grid item>
                  <TextField
                    placeholder="e.g. Gold, USD, Real Estate Fund"
                    variant="standard"
                    color="secondary"
                    multiline
                    fullWidth
                    helperText="Required"
                    onChange={e => setName(e.target.value)}
                  />
                </Grid>
              </Grid>

              {/* Image */}
              <Grid item container direction="column" className={classes.form}>
                <Grid item>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Image
                  </Typography>
                </Grid>
                <Grid item container>
                  <Paper elevation={8} className={classes.photo_container}>
                    {photoURL ? (
                      <Grid item className={classes.photo_preview}>
                        <img src={photoURL} className={classes.photo_preview_img} alt="preview" />
                      </Grid>
                    ) : (
                      <Grid item>
                        <IconButton color="secondary" onClick={handlePhotoClick}>
                          <AddAPhotoIcon />
                          <input
                            type="file"
                            accept=".png, .svg, .jpeg, .jpg"
                            style={{ display: 'none' }}
                            ref={fileInputRef}
                            onChange={handleFileChange}
                          />
                        </IconButton>
                      </Grid>
                    )}
                  </Paper>
                </Grid>
              </Grid>

              {/* Quantity */}
              <Grid item container direction="column" className={classes.form}>
                <Grid item>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Quantity
                  </Typography>
                </Grid>
                <Grid item>
                  <Typography variant="body2">Total units to issue (e.g. ounces, dollars, shares)</Typography>
                </Grid>
                <Grid item>
                  <TextField
                    placeholder="Quantity"
                    value={quantity}
                    variant="standard"
                    color="secondary"
                    fullWidth
                    helperText="Required"
                    onChange={e => setQuantity(e.target.value.replace(/\D/g, ''))}
                  />
                </Grid>
              </Grid>

              {/* Description */}
              <Grid item container direction="column" className={classes.form}>
                <Grid item>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Asset Description
                  </Typography>
                </Grid>
                <Grid item>
                  <TextField
                    placeholder="Describe what this asset represents"
                    multiline
                    variant="standard"
                    color="secondary"
                    fullWidth
                    helperText="Required"
                    onChange={e => setDescription(e.target.value)}
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          {/* Preview box */}
          <Grid container direction="column" className={classes.form}>
            <Grid item>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Preview
              </Typography>
            </Grid>
            <Grid item>
              <Paper elevation={8}>
                <Grid container direction="column" sx={{ padding: '2.5em' }} rowGap="0.5em">
                  <Grid item>
                    <Typography sx={{ wordBreak: 'break-word' }}>Asset: {name}</Typography>
                  </Grid>
                  <Grid item>
                    <Typography sx={{ wordBreak: 'break-word' }}>Description: {description}</Typography>
                  </Grid>
                  <Grid item>
                    <Typography>Quantity: {quantity}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>

          {/* Create button */}
          <Grid container direction="column" className={classes.form}>
            <Grid item sx={{ textAlign: 'right' }} className={classes.button}>
              <Button
                variant="outlined"
                color="secondary"
                onClick={mint}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
              >
                {loading ? 'Issuing...' : 'Issue Asset'}
              </Button>
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </div>
  )
}

export default Mint
