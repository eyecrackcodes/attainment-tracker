import React from "react";
import { AppBar, Toolbar, Typography, Box, IconButton } from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";

export const Navigation = () => {
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
          <Typography variant="body2" color="text.secondary">
            Welcome
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
