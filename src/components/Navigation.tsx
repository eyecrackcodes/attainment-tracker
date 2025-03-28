import React from "react";
import { AppBar, Toolbar, Typography, Box, IconButton } from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";

export const Navigation = () => {
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ px: { xs: 2, lg: 4 } }}>
        <IconButton
          size="large"
          edge="start"
          color="primary"
          aria-label="menu"
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: 1,
            color: "text.primary",
            fontWeight: 600,
          }}
        >
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
