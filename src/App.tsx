import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "./theme";
import { Navigation } from "./components/Navigation";
import { Dashboard } from "./components/Dashboard";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Navigation />
      <Dashboard />
    </ThemeProvider>
  );
}

export default App;
