import { Link } from 'react-router-dom';
import { Box, Typography, Grid, Paper, Button } from '@mui/material';
import TopicIcon from '@mui/icons-material/Topic';
import QuizIcon from '@mui/icons-material/Quiz';
import FolderIcon from '@mui/icons-material/Folder';
import BarChartIcon from '@mui/icons-material/BarChart';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CampaignIcon from '@mui/icons-material/Campaign';
import PeopleIcon from '@mui/icons-material/People';

export function AdminDashboard() {
  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, px: 2 }}>
      <Typography variant="h4" gutterBottom>Admin dashboard</Typography>
      <Typography color="text.secondary" sx={{ mb: 4 }}>
        Manage topics, the question bank, materials, and view usage analytics.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <TopicIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6">Topics</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create chapters and units for Class XI and XII.
            </Typography>
            <Button component={Link} to="/admin/topics" variant="contained">Manage topics</Button>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <QuizIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6">Question bank</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add, edit and tag MCQs across all question types.
            </Typography>
            <Button component={Link} to="/admin/questions" variant="contained">Manage questions</Button>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <FolderIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6">Materials</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload PDFs, DOCX, images and notes for students to read or download.
            </Typography>
            <Button component={Link} to="/admin/materials" variant="contained">Manage materials</Button>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <BarChartIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6">Analytics</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Student counts, average scores, weakest topics, hardest questions, top downloads.
            </Typography>
            <Button component={Link} to="/admin/analytics" variant="contained">View analytics</Button>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <AutoAwesomeIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6">Self-evolution</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Auto-recalibrated difficulty log, flagged questions, manual run.
            </Typography>
            <Button component={Link} to="/admin/evolution" variant="contained">View evolution log</Button>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <AutoAwesomeIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6">AI question generator</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Draft new MCQs for a topic with AI; review and approve each one before it's added.
            </Typography>
            <Button component={Link} to="/admin/ai-generate" variant="contained">Generate questions</Button>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <CampaignIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6">Announcements</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Post updates and exam alerts — sent as push notifications too.
            </Typography>
            <Button component={Link} to="/admin/announcements" variant="contained">Manage announcements</Button>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <PeopleIcon color="primary" sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6">Manage users</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Promote a student to teacher or admin.
            </Typography>
            <Button component={Link} to="/admin/users" variant="contained">Manage users</Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
