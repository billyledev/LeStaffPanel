import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

import { history } from './helpers';
import { PrivateRoute } from './components';
import Home from './pages/home';
import SignIn from './pages/signin';

export default function App() {
  history.navigate = useNavigate();
  history.location = useLocation();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Home/>
          </PrivateRoute>
        }
      />
      <Route path="/signin" element={<SignIn/>}/>
      <Route path="*" element={<Navigate to="/"/>}/>
    </Routes>
  );
}
