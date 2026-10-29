import os
import unittest
from datetime import timedelta
from io import BytesIO
from unittest.mock import mock_open, patch


os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['SECRET_KEY'] = 'test-secret-key'
os.environ['ADMIN_USERNAME'] = 'test-admin'
os.environ['ADMIN_PASSWORD'] = 'test-password-123'
os.environ['AI_API_KEY'] = ''
os.environ['AI_MODEL'] = ''
os.environ['CORS_ORIGINS'] = 'https://solar.example'

import app as backend  # noqa: E402
from services import chatbot  # noqa: E402
from app import (  # noqa: E402
    Activity,
    Admin,
    Lead,
    LEAD_REQUESTS,
    ADMIN_SESSIONS,
    SolarPanel,
    create_app,
    db,
    utc_now_naive,
)
from werkzeug.security import generate_password_hash  # noqa: E402


class ApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.app.config.update(TESTING=True, MAX_CONTENT_LENGTH=16 * 1024)

    @classmethod
    def tearDownClass(cls):
        with cls.app.app_context():
            db.session.remove()
            db.engine.dispose()
        with backend.app.app_context():
            db.session.remove()
            db.engine.dispose()

    def setUp(self):
        self.context = self.app.app_context()
        self.context.push()
        db.drop_all()
        db.create_all()
        db.session.add(Admin(
            username='test-admin',
            password_hash=generate_password_hash('test-password-123'),
        ))
        db.session.commit()
        LEAD_REQUESTS.clear()
        ADMIN_SESSIONS.clear()
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        self.context.pop()

    @staticmethod
    def valid_lead(**overrides):
        data = {
            'name': 'Asha Kumar',
            'phone': '+91 9876543210',
            'email': 'asha@example.com',
            'district': 'Chennai',
            'monthly_bill': 2500,
            'message': 'Interested in rooftop solar',
            'source': 'chatbot',
            'consent': True,
        }
        data.update(overrides)
        return data

    def admin_headers(self):
        response = self.client.post('/api/admin/login', json={
            'username': 'test-admin',
            'password': 'test-password-123',
        })
        self.assertEqual(response.status_code, 200)
        return {'Authorization': f"Bearer {response.get_json()['token']}"}

    def test_health_checks_database_and_returns_service_status(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['status'], 'ok')
        self.assertEqual(response.get_json()['database'], 'ok')

    def test_health_reports_database_outage(self):
        with patch.object(db.session, 'execute', side_effect=RuntimeError('database offline')):
            response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()['database'], 'unavailable')

    def test_cors_allows_configured_frontend_origin(self):
        response = self.client.get('/api/health', headers={'Origin': 'https://solar.example'})
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), 'https://solar.example')

    def test_unknown_route_returns_json_404(self):
        response = self.client.get('/not-a-route')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {'error': 'Endpoint not found.'})

    def test_lead_requires_json_object(self):
        response = self.client.post('/api/leads', json=['not', 'an', 'object'])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Lead.query.count(), 0)

    def test_lead_rejects_invalid_required_fields(self):
        bad_cases = [
            {'name': 'A'},
            {'name': 'A' * 101},
            {'name': 123},
            {'phone': '        '},
            {'phone': '1234567'},
            {'phone': 9876543210},
            {'email': 'not-an-email'},
            {'email': 'a' * 161 + '@example.com'},
            {'district': ['Chennai']},
            {'message': {'unexpected': 'object'}},
            {'consent': False},
            {'consent': 'false'},
        ]
        for override in bad_cases:
            with self.subTest(override=override):
                LEAD_REQUESTS.clear()
                response = self.client.post('/api/leads', json=self.valid_lead(**override))
                self.assertEqual(response.status_code, 400)
                Lead.query.delete()
                db.session.commit()
        self.assertEqual(Lead.query.count(), 0)

    def test_lead_accepts_optional_fields_and_serializes_saved_record(self):
        response = self.client.post('/api/leads', json=self.valid_lead(
            email=None, district=None, monthly_bill=None, message='x' * 1200,
        ))
        self.assertEqual(response.status_code, 201)
        lead = db.session.get(Lead, response.get_json()['id'])
        self.assertIsNone(lead.email)
        self.assertIsNone(lead.district)
        self.assertIsNone(lead.monthly_bill)
        self.assertEqual(len(lead.message), 1000)
        self.assertTrue(lead.consent)
        self.assertEqual(lead.source, 'chatbot')

    def test_lead_rejects_negative_and_non_finite_bills(self):
        for bill in (-1, 'NaN', 'Infinity', float('nan'), float('inf'), True):
            with self.subTest(monthly_bill=bill):
                LEAD_REQUESTS.clear()
                response = self.client.post('/api/leads', json=self.valid_lead(monthly_bill=bill))
                self.assertEqual(response.status_code, 400)
                Lead.query.delete()
                db.session.commit()
        self.assertEqual(Lead.query.count(), 0)

    def test_lead_rate_limit_caps_successful_submissions(self):
        for index in range(5):
            response = self.client.post('/api/leads', json=self.valid_lead(phone=f'+91 98765432{index:02d}'))
            self.assertEqual(response.status_code, 201)
        response = self.client.post('/api/leads', json=self.valid_lead(phone='+91 9876543299'))
        self.assertEqual(response.status_code, 429)
        self.assertEqual(Lead.query.count(), 5)

    def test_invalid_leads_do_not_consume_submission_limit(self):
        for _ in range(6):
            response = self.client.post('/api/leads', json=self.valid_lead(name='x'))
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.post('/api/leads', json=self.valid_lead()).status_code, 201)

    def test_chat_handles_missing_empty_and_invalid_messages(self):
        self.assertEqual(self.client.post('/api/chat', json={}).status_code, 200)
        self.assertEqual(self.client.post('/api/chat', json={'message': '   '}).status_code, 200)
        self.assertEqual(self.client.post('/api/chat', json={'message': 123}).status_code, 400)
        self.assertEqual(self.client.post('/api/chat', json=['unexpected']).status_code, 400)

    def test_chat_uses_grounded_fallback_without_external_ai(self):
        response = self.client.post('/api/chat', json={'message': 'How much energy can solar generate?'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['mode'], 'faq-fallback')
        self.assertIn('Generation depends', response.get_json()['reply'])

    def test_chatbot_retriever_ignores_malformed_documents_and_bad_limits(self):
        data = '[{"title":"Solar generation","content":"generation energy","keywords":"invalid"}, null]'
        with patch('pathlib.Path.open', mock_open(read_data=data)):
            self.assertEqual(len(chatbot.retrieve_context('solar generation')), 1)
            self.assertEqual(chatbot.retrieve_context('solar generation', limit='not-a-number'), [])
            self.assertEqual(chatbot.retrieve_context('solar generation', limit=0), [])

    def test_chatbot_rejects_malformed_provider_responses_without_crashing(self):
        with patch.dict(os.environ, {'AI_API_KEY': 'test-key', 'AI_MODEL': 'test-model'}):
            with patch.object(chatbot, 'urlopen', return_value=BytesIO(b'[]')):
                self.assertIsNone(chatbot._openai_answer('solar question', [], []))
            with patch.object(chatbot, 'urlopen', return_value=BytesIO(b'{"output_text":42}')):
                self.assertIsNone(chatbot._openai_answer('solar question', [], []))
            with patch.object(chatbot, 'urlopen', side_effect=TimeoutError()):
                self.assertIsNone(chatbot._openai_answer('solar question', [], []))

    def test_admin_endpoints_require_authentication(self):
        for path in ('/api/admin/leads', '/api/admin/panels', '/api/admin/activity'):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 401)
        self.assertEqual(self.client.post('/api/admin/login', json={
            'username': 'test-admin', 'password': 'wrong-password',
        }).status_code, 401)

    def test_admin_logout_revokes_token(self):
        headers = self.admin_headers()
        response = self.client.post('/api/admin/logout', headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get('/api/admin/leads', headers=headers).status_code, 401)

    def test_admin_session_expiration_and_malformed_timestamp(self):
        headers = self.admin_headers()
        token = headers['Authorization'].split(' ', 1)[1]
        ADMIN_SESSIONS[token]['created_at'] = utc_now_naive() - timedelta(hours=8, seconds=1)
        response = self.client.get('/api/admin/leads', headers=headers)
        self.assertEqual(response.status_code, 401)
        self.assertNotIn(token, ADMIN_SESSIONS)

        headers = self.admin_headers()
        token = headers['Authorization'].split(' ', 1)[1]
        ADMIN_SESSIONS[token]['created_at'] = 'invalid timestamp'
        response = self.client.get('/api/admin/leads', headers=headers)
        self.assertEqual(response.status_code, 401)
        self.assertNotIn(token, ADMIN_SESSIONS)

    def test_admin_rejects_non_object_payloads(self):
        self.assertEqual(self.client.post('/api/admin/login', json=['bad']).status_code, 400)
        headers = self.admin_headers()
        lead_response = self.client.post('/api/leads', json=self.valid_lead())
        panel = SolarPanel(brand='Test', model='T3', wattage=500, price=25000, active=True)
        db.session.add(panel)
        db.session.commit()
        self.assertEqual(self.client.patch(f"/api/admin/leads/{lead_response.get_json()['id']}", json=['bad'], headers=headers).status_code, 400)
        self.assertEqual(self.client.put(f'/api/admin/panels/{panel.id}', json=['bad'], headers=headers).status_code, 400)

    def test_admin_can_view_and_update_lead_status(self):
        created = self.client.post('/api/leads', json=self.valid_lead())
        headers = self.admin_headers()
        leads = self.client.get('/api/admin/leads', headers=headers)
        self.assertEqual(leads.status_code, 200)
        self.assertEqual(leads.get_json()[0]['id'], created.get_json()['id'])
        updated = self.client.patch(
            f"/api/admin/leads/{created.get_json()['id']}",
            json={'status': 'Contacted'}, headers=headers,
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()['status'], 'Contacted')
        self.assertEqual(Activity.query.count(), 2)

    def test_admin_can_delete_lead_and_deletion_is_logged(self):
        created = self.client.post('/api/leads', json=self.valid_lead())
        lead_id = created.get_json()['id']
        headers = self.admin_headers()

        response = self.client.delete(f'/api/admin/leads/{lead_id}', headers=headers)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'message': 'Lead deleted.', 'id': lead_id})
        self.assertIsNone(db.session.get(Lead, lead_id))
        self.assertEqual(self.client.get('/api/admin/leads', headers=headers).get_json(), [])
        deletion = Activity.query.filter_by(action='Lead deleted').one()
        self.assertEqual(deletion.details, f'Lead #{lead_id} deleted.')

    def test_delete_lead_requires_admin_authentication(self):
        created = self.client.post('/api/leads', json=self.valid_lead())
        lead_id = created.get_json()['id']

        response = self.client.delete(f'/api/admin/leads/{lead_id}')

        self.assertEqual(response.status_code, 401)
        self.assertIsNotNone(db.session.get(Lead, lead_id))

    def test_delete_missing_lead_returns_404_without_activity_entry(self):
        response = self.client.delete('/api/admin/leads/999', headers=self.admin_headers())

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {'error': 'Lead not found.'})
        self.assertEqual(Activity.query.filter_by(action='Lead deleted').count(), 0)

    def test_admin_rejects_invalid_status_and_unknown_lead(self):
        headers = self.admin_headers()
        self.assertEqual(self.client.patch('/api/admin/leads/999', json={'status': 'Converted'}, headers=headers).status_code, 404)
        lead = self.client.post('/api/leads', json=self.valid_lead()).get_json()
        self.assertEqual(self.client.patch(f"/api/admin/leads/{lead['id']}", json={'status': 'Made Up'}, headers=headers).status_code, 400)

    def test_panel_update_rejects_non_finite_invalid_and_non_boolean_values(self):
        panel = SolarPanel(brand='Test', model='T1', wattage=500, price=25000, active=True)
        db.session.add(panel)
        db.session.commit()
        headers = self.admin_headers()
        bad_updates = [
            {'price': 0}, {'price': -1}, {'price': 'NaN'},
            {'price': 'Infinity'}, {'price': True}, {'price': 'not-a-number'},
            {'price': 25000, 'active': 'false'},
        ]
        for payload in bad_updates:
            with self.subTest(payload=payload):
                response = self.client.put(f'/api/admin/panels/{panel.id}', json=payload, headers=headers)
                self.assertEqual(response.status_code, 400)
        self.assertEqual(panel.price, 25000)
        self.assertTrue(panel.active)

    def test_panel_update_accepts_valid_values_and_deactivates(self):
        panel = SolarPanel(brand='Test', model='T2', wattage=500, price=25000, active=True)
        db.session.add(panel)
        db.session.commit()
        response = self.client.put(
            f'/api/admin/panels/{panel.id}',
            json={'price': 27500.5, 'active': False},
            headers=self.admin_headers(),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['price'], 27500.5)
        self.assertFalse(response.get_json()['active'])

    def test_api_rejects_oversized_request_body(self):
        response = self.client.post(
            '/api/chat',
            data='{"message":"' + ('x' * 20000) + '"}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 413)


if __name__ == '__main__':
    unittest.main()
