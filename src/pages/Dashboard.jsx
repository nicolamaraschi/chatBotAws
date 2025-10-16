import React from 'react';
import PropTypes from 'prop-types';
import SapDashboard from './SapDashboard';
import ErrorBoundary from '../components/ErrorBoundary';

const Dashboard = ({
  onBackgroundChange,
  onLogout,
  userRole,
  userClientName,
}) => {
  return (
    <ErrorBoundary>
      <SapDashboard 
        onBackgroundChange={onBackgroundChange} 
        onLogout={onLogout} 
        userRole={userRole}
        userClientName={userClientName}
      />
    </ErrorBoundary>
  );
};

Dashboard.propTypes = {
  onBackgroundChange: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  userRole: PropTypes.string,
  userClientName: PropTypes.string,
};

export default Dashboard;