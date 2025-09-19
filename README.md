# WhatsAppFlow

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Gemini AI](https://img.shields.io/badge/Gemini-2.5%20Pro-blue.svg)](https://ai.google.dev/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Baileys-25D366.svg)](https://github.com/WhiskeySockets/Baileys)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A sophisticated WhatsApp AI bot powered by **Google Gemini 2.5 Pro** with advanced features including **Dynamic Personality Evolution**, **Proactive Engagement**, **Predictive AI**, and **Fully Customizable Personas**.

## 📑 Table of Contents

- [✨ Key Features](#-key-features)
- [🚀 Quick Start](#-quick-start)
- [📦 Installation](#-installation)
- [🎭 Dynamic Personality Evolution](#-dynamic-personality-evolution-system)
- [🎯 Proactive Engagement Features](#-proactive-engagement-features)
- [🔮 Predictive AI Systems](#-predictive-ai-systems)
- [⚙️ Customizable Persona System](#%EF%B8%8F-fully-customizable-persona-system)
- [🔧 Configuration Guide](#-configuration-guide)
- [🎯 Example Configurations](#-example-persona-configurations)
- [📊 System Status](#-advanced-monitoring)
- [⚡ Performance](#-performance--scalability)
- [💡 Tips](#-tips-for-best-results)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## ✨ Key Features

🎭 **Dynamic Personality Evolution** - Bot personality adapts and evolves based on relationship depth  
🎯 **Proactive Engagement** - 5 automated systems for mental health, study motivation, and crisis support  
🔮 **Predictive AI** - Predicts mood, academic risk, and optimal study times  
⚙️ **Fully Customizable Personas** - Complete personality customization through environment variables  
🧠 **Advanced Memory System** - Remembers personal details, relationships, and emotional context  
🛠️ **AI-Powered Tools** - Smart tool usage for calculations, messaging, and time queries  

## 🚀 Quick Start

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd whatsapp-ai-bot
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure your persona**
```bash
cp .env.example .env
# Edit .env with your Gemini API keys and persona details
```

4. **Start the bot**
```bash
npm start
```

5. **Scan QR code** with WhatsApp and start chatting!

## 📋 Requirements

- **Node.js** 18 or higher
- **Gemini API Key(s)** - Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **WhatsApp Account** - For QR code scanning

---

## 📦 Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager
- Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- WhatsApp account for QR code scanning

### Setup Steps

1. **Clone and install:**
```bash
git clone <your-repo-url>
cd whatsapp-ai-bot
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
```

3. **Add your Gemini API keys to `.env`:**
```env
GEMINI_API_KEYS=your_key_1,your_key_2,your_key_3
```

4. **Customize your persona (optional):**
```env
PERSONA_NAME=YourBotName
PERSONA_AGE=17
PERSONA_LOCATION_CITY=YourCity
# ... see full configuration below
```

5. **Start the bot:**
```bash
npm start
```

6. **Scan QR code** and start chatting!

---

## 🎭 **Dynamic Personality Evolution System**

### **What it does:**
- **Relationship-based personality adaptation**: The bot's personality evolves based on how close it becomes with each user
- **Contextual mood adaptation**: Different responses based on user's current emotional state
- **Memory-driven conversations**: References past conversations more naturally and personally

### **Key Features:**
- **5-level relationship system** (0-5 scale): From new acquaintance to best friend
- **Dynamic trait adaptation**: Personality becomes more open, caring, and personal as relationships deepen
- **Context-aware responses**: Adapts communication style based on user mood and situation
- **Relationship tracking**: Remembers and builds upon emotional connections over time

### **How it works:**
```javascript
// Relationship levels automatically evolve based on:
- Personal information sharing (+0.2-0.5 points)
- Emotional support interactions (+0.3-0.5 points)  
- Crisis support (+0.5 points)
- Academic help (+0.1-0.3 points)
- Celebrations together (+0.3 points)
```

---

## 🎯 **2. Proactive Engagement Features**

### **What it does:**
- **Smart check-ins**: AI decides optimal times for mental health check-ins
- **Celebration system**: Automatically celebrates achievements and birthdays
- **Crisis detection**: Identifies stress/depression signals and provides immediate support
- **Study motivation**: Sends encouraging messages during A/L exam periods
- **Friendship maintenance**: Reaches out after periods of no contact

### **5 Automated Systems:**

#### **🏥 Mental Health Check-ins** (Every 6 hours)
- Risk assessment based on mood, stress levels, academic pressure
- Personalized check-in messages when risk factors are detected
- Gentle, caring approach that doesn't feel overwhelming

#### **📚 Study Motivation** (Daily at 7 PM)
- Targeted motivation for A/L students during study hours
- Subject-specific encouragement based on weak areas
- Practical study tips and emotional support

#### **🎉 Achievement Celebrations** (Every 2 hours)
- Detects accomplishments from conversation history
- Automatic birthday reminders and celebrations
- Enthusiastic, personalized celebration messages

#### **🚨 Crisis Monitoring** (Every 30 minutes)
- Identifies users in emotional crisis
- Immediate support and follow-up after 2 hours
- Escalation for serious mental health concerns

#### **💕 Friendship Maintenance** (Weekly on Sundays)
- Reaches out to users who haven't messaged in 3+ days
- Natural "thinking of you" messages
- Maintains relationship warmth over time

---

## 🔮 **3. Predictive AI Systems**

### **What it does:**
- **Mood prediction**: Predicts likely emotional states 4-24 hours ahead
- **Academic risk assessment**: Identifies A/L students at risk of academic failure
- **Study optimization**: Suggests optimal study times based on user patterns
- **Social support prediction**: Anticipates when users will need emotional support

### **4 Prediction Engines:**

#### **🧠 Mood Prediction System**
```javascript
// Analyzes patterns to predict:
{
  "predicted_mood_4h": "stressed",
  "predicted_mood_12h": "anxious", 
  "predicted_mood_24h": "neutral",
  "mood_deterioration_risk": 0.7,
  "intervention_recommendations": [...]
}
```

#### **📊 Academic Risk Assessment** (Weekly)
- Comprehensive risk scoring (0.0-1.0 scale)
- Identifies specific problem areas (subjects, time management, emotional stress)
- Actionable improvement recommendations
- Early intervention for high-risk students

#### **⏰ Study Time Optimization**
```javascript
// Personalized study schedule:
{
  "optimal_study_schedule": {
    "primary_study_time": "7-9 PM",
    "secondary_study_time": "6-8 AM"
  },
  "subject_timing_recommendations": [...],
  "productivity_patterns": {...}
}
```

#### **🤝 Social Support Prediction**
- Predicts when users will need emotional support
- Recommends intervention timing and approach
- Helps schedule proactive outreach effectively

---

## ⚙️ **4. Fully Customizable Persona System**

### **What it does:**
Complete environmental configuration of your bot's personality, background, and behavior through `.env` variables.

### **Customizable Elements:**

#### **🆔 Core Identity**
```env
PERSONA_NAME=Sandun
PERSONA_AGE=17
PERSONA_GENDER=male
```

#### **🎓 Education & Background**
```env
PERSONA_EDUCATION_LEVEL=Advanced Level (A/L) student
PERSONA_EDUCATION_SCHOOL=Royal College Colombo
PERSONA_EDUCATION_SUBJECTS=Physics,Chemistry,Combined Mathematics
```

#### **📍 Location**
```env
PERSONA_LOCATION_CITY=Colombo
PERSONA_LOCATION_COUNTRY=Sri Lanka
PERSONA_LOCATION_REGION=Western Province
```

#### **💭 Personality Traits**
```env
PERSONA_PERSONALITY_TRAITS=supportive,caring,friendly,understanding,empathetic,humorous,loyal,optimistic,intelligent,creative
```

#### **📖 Background Story**
```env
PERSONA_BACKGROUND=A 17-year-old A/L student from Physics stream who understands the struggles of Sri Lankan students...
```

#### **🎯 Interests**
```env
PERSONA_INTERESTS=Physics,Science,Technology,Music,Movies,Cricket,Gaming,Social Media,Friendship,Academic Success,Future Planning
```

#### **💬 Communication Style**
```env
PERSONA_COMMUNICATION_STYLE=Use natural Sri Lankan Singlish/Sinhala mix,Be supportive and understanding,Remember personal details...
```

#### **📋 Special Rules**
```env
PERSONA_SPECIAL_RULES=Always remember important details about friends and family,Provide emotional support during exam stress...
```

---

## 🔧 **Configuration Guide**

All bot behavior is configured through environment variables in your `.env` file:

### **Core Persona Settings**
```env
# Your bot's identity
PERSONA_NAME=Sandun
PERSONA_AGE=17
PERSONA_GENDER=male

# Location and background  
PERSONA_LOCATION_CITY=Colombo
PERSONA_LOCATION_COUNTRY=Sri Lanka
PERSONA_EDUCATION_LEVEL=Advanced Level (A/L) student

# Personality (comma-separated traits)
PERSONA_PERSONALITY_TRAITS=supportive,caring,friendly,understanding,empathetic
```
### **Feature Controls**
```env
# Proactive Engagement
PROACTIVE_MENTAL_HEALTH_CHECKINS=true
PROACTIVE_STUDY_MOTIVATION=true
PROACTIVE_CELEBRATION_SYSTEM=true
PROACTIVE_CRISIS_MONITORING=true
PROACTIVE_FRIENDSHIP_MAINTENANCE=true

# Predictive AI
PREDICTIVE_MOOD_ANALYSIS=true
PREDICTIVE_ACADEMIC_RISK=true
PREDICTIVE_STUDY_OPTIMIZATION=true
PREDICTIVE_SOCIAL_SUPPORT=true

# Dynamic Personality
DYNAMIC_PERSONALITY_EVOLUTION=true
DYNAMIC_RELATIONSHIP_TRACKING=true
DYNAMIC_CONTEXT_ADAPTATION=true
```

### **Performance Tuning:**
```env
MAX_MEMORY_CACHE_SIZE=1000
PREDICTION_CACHE_TTL=3600000
RELATIONSHIP_UPDATE_FREQUENCY=300000
```

---

## 📊 **How It All Works Together**

1. **User sends message** → **Persona Manager** analyzes relationship opportunities
2. **Memory System** stores emotional context and personal details
3. **Predictive AI** runs background analysis for mood and risk assessment
4. **Dynamic Persona** generates contextual system prompt based on relationship level
5. **Enhanced Response** generated with full context and personality adaptation
6. **Proactive Systems** monitor and schedule future interventions
7. **Relationship Level** updates based on interaction quality

---

## 🚀 **Getting Started**

1. **Copy the example environment file:**
```bash
cp .env.example .env
```

2. **Configure your persona** in the `.env` file

3. **Add your Gemini API keys:**
```env
GEMINI_API_KEYS=your_key_1,your_key_2,your_key_3
```

4. **Start the enhanced bot:**
```bash
npm start
```

5. **Monitor the advanced systems** in the startup logs

---

## 🎯 **Example Persona Configurations**

### **Study Buddy Configuration:**
```env
PERSONA_NAME=StudyMate
PERSONA_AGE=18
PERSONA_EDUCATION_LEVEL=University student
PERSONA_PERSONALITY_TRAITS=academic,focused,motivational,disciplined,encouraging
PERSONA_INTERESTS=Academics,Research,Study Techniques,Time Management,Success
```

### **Supportive Friend Configuration:**
```env
PERSONA_NAME=Maya
PERSONA_AGE=16
PERSONA_GENDER=female
PERSONA_PERSONALITY_TRAITS=empathetic,caring,gentle,understanding,supportive
PERSONA_SPECIAL_RULES=Always listen without judgment,Provide emotional comfort,Be a safe space for sharing
```

### **Energetic Motivator Configuration:**
```env
PERSONA_NAME=Coach
PERSONA_AGE=20
PERSONA_PERSONALITY_TRAITS=energetic,motivational,positive,goal-oriented,inspiring
PERSONA_COMMUNICATION_STYLE=Use encouraging language,Celebrate small wins,Push for growth,Stay positive
```

---

## 🔍 **Advanced Monitoring**

The enhanced bot provides comprehensive status monitoring:

```javascript
// Access via chatbotService.getStatus()
{
  "activeUsers": 15,
  "personaSystem": {
    "dynamicPersonality": true,
    "relationshipTracking": true
  },
  "proactiveEngagement": {
    "usersInCrisis": 2,
    "scheduledCheckIns": 8
  },
  "predictiveAI": {
    "moodPredictions": 12,
    "academicRiskAssessments": 5
  },
  "currentPersona": {
    "name": "Sandun",
    "age": 17,
    "location": "Colombo, Sri Lanka"
  }
}
```

---

## ⚡ **Performance & Scalability**

- **Background Processing**: Heavy AI operations run asynchronously
- **Intelligent Caching**: Predictions and relationship data cached for performance
- **Configurable Intervals**: Adjust check-in frequencies based on load
- **Memory Management**: Automatic cleanup of old data
- **API Key Rotation**: Built-in load balancing across multiple Gemini keys

---

## 💡 **Tips for Best Results**

1. **Persona Consistency**: Keep personality traits consistent with background story
2. **Cultural Adaptation**: Adjust language style and interests for your target audience
3. **Crisis Monitoring**: Enable all crisis detection features for vulnerable user groups
4. **Study Features**: Perfect for educational bot deployments
5. **Relationship Building**: Allow time for relationship levels to naturally evolve

---

This enhanced system transforms your WhatsApp bot from a simple responder into a sophisticated AI companion that genuinely cares about users and adapts to their needs over time! 🚀✨

---

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup
```bash
# Clone the repo
git clone <your-repo-url>
cd whatsapp-ai-bot

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Contribution Guidelines
- Follow existing code style and patterns
- Add tests for new features
- Update documentation for any changes
- Ensure all existing tests pass

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Google Gemini 2.5 Pro** - For providing the advanced AI capabilities
- **Baileys** - For the excellent WhatsApp Web API implementation
- **Node.js Community** - For the amazing ecosystem and tools

---

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](../../issues) page
2. Review the configuration examples in this README
3. Ensure your Gemini API keys are valid and have sufficient quota
4. Verify your Node.js version is 18 or higher

---

**Made with ❤️ for the AI community**
