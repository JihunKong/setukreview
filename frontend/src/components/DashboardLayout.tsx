import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
  Fab,
  Zoom,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { CategorySidebar, CategorySummary } from './CategorySidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  
  // Sidebar props
  categories: CategorySummary;
  selectedCategories: string[];
  onCategorySelect: (category: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onValidateSelected: () => void;
  onValidateCategory: (category: string) => void;
  onValidateAll: () => void;
  isValidating: boolean;
  totalFiles: number;
  
  // Layout props
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
}

const DRAWER_WIDTH = 320;

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  categories,
  selectedCategories,
  onCategorySelect,
  onSelectAll,
  onDeselectAll,
  onValidateSelected,
  onValidateCategory,
  onValidateAll,
  isValidating,
  totalFiles,
  title = '📚 학교생활기록부 점검 도우미',
  subtitle = '여러 파일을 업로드하고 카테고리별로 검증하세요',
  onRefresh,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerClose = () => {
    setMobileOpen(false);
  };

  const sidebarContent = (
    <CategorySidebar
      categories={categories}
      selectedCategories={selectedCategories}
      onCategorySelect={onCategorySelect}
      onSelectAll={onSelectAll}
      onDeselectAll={onDeselectAll}
      onValidateSelected={onValidateSelected}
      onValidateCategory={onValidateCategory}
      onValidateAll={onValidateAll}
      isValidating={isValidating}
      totalFiles={totalFiles}
    />
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          backgroundColor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
        elevation={0}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle sidebar"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          </Box>

          {onRefresh && (
            <Tooltip title="새로고침">
              <IconButton
                color="inherit"
                onClick={onRefresh}
                disabled={isValidating}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerClose}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              borderRight: 'none',
              boxShadow: theme.shadows[8],
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, minHeight: 64 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              파일 관리
            </Typography>
            <IconButton onClick={handleDrawerClose}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ height: 'calc(100vh - 64px)' }}>
            {sidebarContent}
          </Box>
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: DRAWER_WIDTH,
              position: 'relative',
              height: '100vh',
              borderRight: 'none',
            },
          }}
          open
        >
          {sidebarContent}
        </Drawer>
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          backgroundColor: 'background.default',
          minHeight: '100vh',
          position: 'relative',
        }}
      >
        {/* Toolbar spacer */}
        <Toolbar />
        
        {/* Content area */}
        <Box sx={{ p: 3, height: 'calc(100vh - 64px)', overflow: 'auto' }}>
          {children}
        </Box>

        {/* Floating Action Button for mobile validation */}
        {isMobile && totalFiles > 0 && (
          <Box sx={{ position: 'fixed', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Zoom in={selectedCategories.length > 0}>
              <Tooltip title={`선택된 카테고리 검증 (${selectedCategories.length}개)`}>
                <Fab
                  color="secondary"
                  size="medium"
                  onClick={onValidateSelected}
                  disabled={isValidating}
                  sx={{ mb: 1 }}
                >
                  <RefreshIcon />
                </Fab>
              </Tooltip>
            </Zoom>
            
            <Tooltip title={`전체 파일 검증 (${totalFiles}개)`}>
              <Fab
                color="primary"
                onClick={onValidateAll}
                disabled={isValidating}
              >
                <RefreshIcon />
              </Fab>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
};