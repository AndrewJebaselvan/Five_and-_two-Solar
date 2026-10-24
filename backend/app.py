import os
import re
import secrets
import time
from datetime import datetime, timezone
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash
from services.chatbot import answer_question, fallback_reply, uses_panel_catalogue

load_dotenv()
db = SQLAlchemy()

class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

class SolarPanel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    brand = db.Column(db.String(100), nullable=False)
    model = db.Column(db.String(120), nullable=False)
    wattage = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Float, nullable=False)
    efficiency = db.Column(db.String(30), nullable=True)
    active = db.Column(db.Boolean, default=True, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Lead(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(30), nullable=False)
    email = db.Column(db.String(160), nullable=True)
    district = db.Column(db.String(100), nullable=True)
    monthly_bill = db.Column(db.Float, nullable=True)
    message = db.Column(db.String(1000), nullable=True)
    source = db.Column(db.String(30), default='website', nullable=False)
    consent = db.Column(db.Boolean, default=False, nullable=False)
    status = db.Column(db.String(40), default='New', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

class Activity(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    admin_username = db.Column(db.String(80), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

# In-memory sessions are suitable for this learning starter only. Use a persistent
# session store / established auth provider before production deployment.
ADMIN_SESSIONS = {}
LEAD_REQUESTS = {}  # Simple local-dev throttling; use a shared rate limiter in production.
VALID_STATUSES = {'New', 'Contacted', 'Site Visit Scheduled', 'Quoted', 'Converted', 'Not Interested'}


def utc_iso(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


def panel_json(panel):
    return {'id': panel.id, 'brand': panel.brand, 'model': panel.model, 'wattage': panel.wattage,
            'price': panel.price, 'efficiency': panel.efficiency, 'active': panel.active,
            'updated_at': utc_iso(panel.updated_at)}


def lead_json(lead):
    return {'id': lead.id, 'name': lead.name, 'phone': lead.phone, 'email': lead.email,
            'district': lead.district, 'monthly_bill': lead.monthly_bill, 'message': lead.message,
            'source': lead.source, 'consent': lead.consent, 'status': lead.status,
            'created_at': utc_iso(lead.created_at)}


def activity_log(action, details):
    username = getattr(g, 'admin_username', 'system')
    db.session.add(Activity(admin_username=username, action=action, details=details[:500]))
    db.session.commit()


def require_admin(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        auth = request.headers.get('Authorization', '')
        token = auth.removeprefix('Bearer ').strip() if auth.startswith('Bearer ') else ''
        session = ADMIN_SESSIONS.get(token)
        if not session:
            return jsonify({'error': 'Authentication required.'}), 401
        g.admin_username = session['username']
        return fn(*args, **kwargs)
    return wrapped


def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'development-only-change-me')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///five_two_energy_dev.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    origins = [x.strip() for x in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if x.strip()]
    CORS(app, resources={r'/api/*': {'origins': origins}})
    db.init_app(app)

    with app.app_context():
        db.create_all()
        admin_name = os.getenv('ADMIN_USERNAME', 'admin')
        admin_password = os.getenv('ADMIN_PASSWORD', '')
        if not Admin.query.filter_by(username=admin_name).first() and admin_password and admin_password != 'change-this-before-running':
            db.session.add(Admin(username=admin_name, password_hash=generate_password_hash(admin_password)))
            db.session.commit()
    @app.get('/api/health')
    def health():
        return jsonify({'status': 'ok', 'service': 'Five and Two Energy Solutions API'})

    @app.get('/api/panels')
    def public_panels():
        return jsonify([panel_json(p) for p in SolarPanel.query.filter_by(active=True).order_by(SolarPanel.brand).all()])

    @app.post('/api/leads')
    def create_lead():
        client_ip = request.remote_addr or 'unknown'
        now = time.time()
        recent = [stamp for stamp in LEAD_REQUESTS.get(client_ip, []) if now - stamp < 600]
        if len(recent) >= 5:
            LEAD_REQUESTS[client_ip] = recent
            return jsonify({'error': 'Too many enquiries from this connection. Please try again in a few minutes.'}), 429
        recent.append(now)
        LEAD_REQUESTS[client_ip] = recent
        data = request.get_json(silent=True) or {}
        name = str(data.get('name', '')).strip()
        phone = re.sub(r'\s+', ' ', str(data.get('phone', '')).strip())
        email = str(data.get('email', '')).strip() or None
        if len(name) < 2 or len(name) > 100:
            return jsonify({'error': 'Please enter a name between 2 and 100 characters.'}), 400
        if not re.fullmatch(r'[0-9+()\- ]{8,20}', phone):
            return jsonify({'error': 'Please enter a valid contact number.'}), 400
        if email and (len(email) > 160 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email)):
            return jsonify({'error': 'Please enter a valid email address.'}), 400
        if not data.get('consent'):
            return jsonify({'error': 'Consent is required before we can save an enquiry.'}), 400
        monthly_bill = data.get('monthly_bill')
        try:
            monthly_bill = float(monthly_bill) if monthly_bill not in (None, '') else None
            if monthly_bill is not None and monthly_bill < 0: raise ValueError()
        except (ValueError, TypeError):
            return jsonify({'error': 'Monthly bill must be a non-negative number.'}), 400
        lead = Lead(name=name, phone=phone, email=email, district=str(data.get('district', '')).strip()[:100] or None,
                    monthly_bill=monthly_bill, message=str(data.get('message', '')).strip()[:1000] or None,
                    source='chatbot' if data.get('source') == 'chatbot' else 'website', consent=True)
        db.session.add(lead)
        db.session.commit()
        return jsonify({'message': 'Enquiry saved.', 'id': lead.id}), 201

    @app.post('/api/chat')
    def chat():
        data = request.get_json(silent=True) or {}
        raw_message = data.get('message', '')
        if not isinstance(raw_message, str):
            return jsonify({'error': 'Message must be text.'}), 400
        message = raw_message.strip()[:1000]
        if not message:
            return jsonify({'reply': 'Please type a question about solar panels, generation, pricing or schemes.'})
        panels = []
        if uses_panel_catalogue(message):
            panels = [panel_json(p) for p in SolarPanel.query.filter_by(active=True).order_by(SolarPanel.brand).all()]
        result = answer_question(message, panels)
        if not result:
            result = {'reply': fallback_reply(message, bool(panels)), 'mode': 'faq-fallback', 'sources': []}
        return jsonify(result)

    @app.post('/api/admin/login')
    def admin_login():
        data = request.get_json(silent=True) or {}
        username = str(data.get('username', '')).strip()
        password = str(data.get('password', ''))
        admin = Admin.query.filter_by(username=username).first()
        if not admin or not check_password_hash(admin.password_hash, password):
            return jsonify({'error': 'Invalid username or password.'}), 401
        token = secrets.token_urlsafe(32)
        ADMIN_SESSIONS[token] = {'username': admin.username, 'created_at': datetime.utcnow()}
        g.admin_username = admin.username
        activity_log('Admin login', 'Signed in to admin dashboard')
        return jsonify({'token': token, 'username': admin.username})

    @app.get('/api/admin/leads')
    @require_admin
    def admin_leads():
        return jsonify([lead_json(x) for x in Lead.query.order_by(Lead.created_at.desc()).all()])

    @app.patch('/api/admin/leads/<int:lead_id>')
    @require_admin
    def update_lead(lead_id):
        lead = db.session.get(Lead, lead_id)
        if not lead: return jsonify({'error': 'Lead not found.'}), 404
        status = str((request.get_json(silent=True) or {}).get('status', ''))
        if status not in VALID_STATUSES: return jsonify({'error': 'Unsupported lead status.'}), 400
        old = lead.status
        lead.status = status
        db.session.commit()
        activity_log('Lead status changed', f'Lead #{lead.id}: {old} → {status}')
        return jsonify(lead_json(lead))

    @app.get('/api/admin/panels')
    @require_admin
    def admin_panels():
        return jsonify([panel_json(p) for p in SolarPanel.query.order_by(SolarPanel.brand).all()])

    @app.put('/api/admin/panels/<int:panel_id>')
    @require_admin
    def update_panel(panel_id):
        panel = db.session.get(SolarPanel, panel_id)
        if not panel: return jsonify({'error': 'Panel not found.'}), 404
        data = request.get_json(silent=True) or {}
        try: price = float(data.get('price'))
        except (TypeError, ValueError): return jsonify({'error': 'Price must be a number.'}), 400
        if price <= 0 or price > 10000000: return jsonify({'error': 'Enter a valid positive price.'}), 400
        panel.price = price
        if 'active' in data: panel.active = bool(data['active'])
        db.session.commit()
        activity_log('Panel catalogue updated', f'{panel.brand} {panel.model}: price set to {price:.2f}')
        return jsonify(panel_json(panel))

    @app.get('/api/admin/activity')
    @require_admin
    def admin_activity():
        items = Activity.query.order_by(Activity.created_at.desc()).limit(100).all()
        return jsonify([{'id': x.id, 'admin_username': x.admin_username, 'action': x.action, 'details': x.details, 'created_at': utc_iso(x.created_at)} for x in items])

    @app.errorhandler(404)
    def not_found(_): return jsonify({'error': 'Endpoint not found.'}), 404

    @app.errorhandler(500)
    def server_error(_):
        db.session.rollback()
        return jsonify({'error': 'Unexpected server error. Check the backend terminal.'}), 500

    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=os.getenv('FLASK_DEBUG', 'false').lower() == 'true', port=5000)
