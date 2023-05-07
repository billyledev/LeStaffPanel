import { useDispatch, useSelector } from 'react-redux';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import { authActions } from '../../store';

export default function Home() {
  const dispatch = useDispatch();
  const { user: authUser } = useSelector(x => x.auth);

  const signout = () => dispatch(authActions.logout());

  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome {authUser?.username}!
        </Typography>
        <Button
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          onClick={signout}
        >
          Sign Out
        </Button>
      </Box>
    </Container>
  );
}
