import { Routes, Route, Navigate } from 'react-router-dom'
import { PrivateRoute, ActiveUserRoute, IndustryRoute, SuperAdminRoute } from './guards'
import LandingPage from '../components/landing/LandingPage'
import LegalPage from '../components/landing/LegalPage'
import SurveyPage from '../components/public/SurveyPage'
import PatientIntakePage from '../components/public/PatientIntakePage'
import AppointmentResponsePage from '../components/public/AppointmentResponsePage'
import LoginPage from '../components/auth/LoginPage'
import RegisterPage from '../components/auth/RegisterPage'
import ForgotPasswordPage from '../components/auth/ForgotPasswordPage'
import PendingActivationPage from '../components/auth/PendingActivationPage'
import CheckoutPage from '../components/auth/CheckoutPage'
import B2BDashboard from '../components/dashboards/b2b/B2BDashboard'
import MedicalDashboard from '../components/dashboards/medical/MedicalDashboard'
import PropertyDashboard from '../components/dashboards/property/PropertyDashboard'
import RetailDashboard from '../components/dashboards/retail/RetailDashboard'
import SuperAdminDashboard from '../components/superadmin/SuperAdminDashboard'

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/survey/:userId/:surveyId" element={<SurveyPage />} />
      <Route path="/intake/:userId" element={<PatientIntakePage />} />
      <Route path="/appt/:userId/:appointmentId" element={<AppointmentResponsePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/legal/terms" element={<LegalPage title="Terms of Service" />} />
      <Route path="/legal/privacy" element={<LegalPage title="Privacy Policy" />} />

      {/* Pending activation */}
      <Route element={<PrivateRoute />}>
        <Route path="/pending-activation" element={<PendingActivationPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/complete" element={<CheckoutPage />} />
      </Route>

      {/* Industry dashboards */}
      <Route element={<IndustryRoute industry="b2b" />}>
        <Route path="/b2b/*" element={<B2BDashboard />} />
      </Route>
      <Route element={<IndustryRoute industry="medical" />}>
        <Route path="/medical/*" element={<MedicalDashboard />} />
      </Route>
      <Route element={<IndustryRoute industry="property" />}>
        <Route path="/property/*" element={<PropertyDashboard />} />
      </Route>
      <Route element={<IndustryRoute industry="retail" />}>
        <Route path="/retail/*" element={<RetailDashboard />} />
      </Route>

      {/* Super admin */}
      <Route element={<SuperAdminRoute />}>
        <Route path="/superadmin/*" element={<SuperAdminDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
