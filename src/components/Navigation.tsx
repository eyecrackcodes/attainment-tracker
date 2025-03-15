import React from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Button,
  Avatar,
} from "@mui/material";
import { Menu as MenuIcon, Logout as LogoutIcon } from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";

export const Navigation = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AppBar position="sticky" elevation={1}>
      <Toolbar>
        <IconButton
          size="large"
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Revenue Dashboard
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {user && (
            <>
              <Avatar
                src={user.photoURL || undefined}
                alt={user.displayName || "User"}
                sx={{ width: 32, height: 32 }}
              />
              <Typography variant="body2" color="text.secondary">
                {user.displayName || user.email}
              </Typography>
              <Button
                color="inherit"
                onClick={handleSignOut}
                startIcon={<LogoutIcon />}
              >
                Sign Out
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};
