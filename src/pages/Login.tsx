import React, { useEffect } from "react";
import { Box, Button, Container, Typography, Paper } from "@mui/material";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import GoogleIcon from "@mui/icons-material/Google";

const Login: React.FC = () => {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // Navigation will happen automatically due to the useEffect
    } catch (error) {
      console.error("Failed to sign in:", error);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom>
            Attainment Tracker
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Sign in to access your dashboard
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleSignIn}
            sx={{ mt: 2 }}
            fullWidth
          >
            Sign in with Google
          </Button>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;
