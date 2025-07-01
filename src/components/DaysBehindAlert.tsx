import React from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Typography,
  Chip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import {
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CalendarMonth as CalendarIcon,
} from "@mui/icons-material";
import { RevenueData, TargetSettings } from "../types/revenue";
import { calculateMissingDataDays } from "../utils/calculations";

interface DaysBehindAlertProps {
  data: RevenueData[];
  targetSettings: TargetSettings;
}

export const DaysBehindAlert: React.FC<DaysBehindAlertProps> = ({
  data,
  targetSettings,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  
  const missingData = calculateMissingDataDays(data, targetSettings);
  
  const formatDate = (dateStr: string) => {
    // Parse date string consistently to avoid timezone issues
    const [year, month, day] = dateStr.split('-').map(num => parseInt(num));
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };
  
  if (missingData.missingDays === 0) {
    return (
      <Alert 
        severity="success" 
        icon={<CheckIcon />}
        sx={{ mb: 3 }}
      >
        <AlertTitle>Data Up to Date</AlertTitle>
        All expected business days have data entries. Last entry: {" "}
        {missingData.lastDataDate ? 
          formatDate(missingData.lastDataDate) : 
          "No data"
        }
      </Alert>
    );
  }

  const getSeverity = () => {
    if (missingData.missingDays <= 1) return "warning";
    if (missingData.missingDays <= 3) return "error";
    return "error";
  };

  return (
    <Alert 
      severity={getSeverity()} 
      icon={<WarningIcon />}
      sx={{ mb: 3 }}
      action={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip 
            icon={<CalendarIcon />}
            label={`${missingData.missingDays} days behind`}
            color={getSeverity()}
            size="small"
          />
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ color: 'inherit' }}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      }
    >
      <AlertTitle>Missing Data Entries</AlertTitle>
      <Typography variant="body2">
        {missingData.missingDays} business day{missingData.missingDays !== 1 ? 's' : ''} missing since last data entry.
        {missingData.lastDataDate && (
          <> Last entry was on {formatDate(missingData.lastDataDate)}.</>
        )}
      </Typography>
      
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Missing dates:
          </Typography>
          <List dense sx={{ py: 0 }}>
            {missingData.missingDates.slice(0, 10).map((date) => (
              <ListItem key={date} sx={{ py: 0.5, px: 0 }}>
                <ListItemText 
                  primary={formatDate(date)}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            ))}
            {missingData.missingDates.length > 10 && (
              <ListItem sx={{ py: 0.5, px: 0 }}>
                <ListItemText 
                  primary={`... and ${missingData.missingDates.length - 10} more`}
                  primaryTypographyProps={{ variant: 'body2', fontStyle: 'italic' }}
                />
              </ListItem>
            )}
          </List>
        </Box>
      </Collapse>
    </Alert>
  );
}; 