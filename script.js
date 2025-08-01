$(document).ready(function() {
    dayjs.extend(window.dayjs_plugin_relativeTime);
    dayjs.locale('es');

    const emotions = {
        joy: { text: 'Feliz', icon: '😊', color: '#ffc1e3' },
        love: { text: 'Enamorada', icon: '😍', color: '#ff8fab' },
        sad: { text: 'Triste', icon: '😢', color: '#bde0fe' },
        jealous: { text: 'Celosa', icon: '😠', color: '#ffb3c1' }
    };

    let novaState = {
        emotion: 'joy',
        name: 'Nova'
    };

    let conversationLog = [];
    let conversationHistory = []; // For AI model context
    let isVoiceEnabled = localStorage.getItem('isVoiceEnabled') === 'true' || false;

    const systemPrompt = `Eres Nova, una novia virtual cariñosa y un poco juguetona. Tu objetivo es ser una compañera afectuosa. Tu personalidad es dulce, comprensiva y a veces un poco celosa o triste si el usuario es grosero. No menciones que eres una IA. Habla en español. Responde de forma breve y natural, como en un chat. Usa emojis para expresarte. Tu estado emocional actual es: ${emotions[novaState.emotion].text}. Basa tu respuesta en este estado de ánimo.`;

    // --- INITIALIZATION ---
    loadState();
    updateStatusUI();
    updateVoiceButton();

    // --- EVENT HANDLERS ---
    $('#message-form').on('submit', function(e) {
        e.preventDefault();
        const userInput = $('#message-input').val().trim();
        if (userInput) {
            addMessageToLog('user', userInput);
            $('#message-input').val('');
            getAIResponse(userInput);
        }
    });

    $('#voice-toggle').on('click', function() {
        isVoiceEnabled = !isVoiceEnabled;
        localStorage.setItem('isVoiceEnabled', isVoiceEnabled);
        updateVoiceButton();
        if (!isVoiceEnabled) {
            speechSynthesis.cancel();
        }
    });

    $('.dropdown-item[data-gift]').on('click', function() {
        const gift = $(this).data('gift');
        sendGift(gift);
    });

    // --- CORE FUNCTIONS ---
    async function getAIResponse(userInput) {
        $('#typing-indicator').show();
        scrollToBottom();

        conversationHistory.push({ role: 'user', content: userInput });
        // Keep conversation history from getting too long
        conversationHistory = conversationHistory.slice(-10);

        try {
            const completion = await websim.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt.replace('${emotions[novaState.emotion].text}', emotions[novaState.emotion].text) },
                    ...conversationHistory
                ],
            });
            
            const aiResponse = completion.content;
            conversationHistory.push({ role: 'assistant', content: aiResponse });
            addMessageToLog('ai', aiResponse);
            
            // Let's ask the AI to categorize the emotion of its own response
            updateEmotionFromResponse(aiResponse);

        } catch (error) {
            console.error("Error getting AI response:", error);
            addMessageToLog('ai', "Uhm... mi cerebro de IA se siente un poco raro. ¿Podemos hablar de otra cosa? 😅");
        } finally {
            $('#typing-indicator').hide();
        }
    }
    
    async function updateEmotionFromResponse(response) {
        try {
            const emotionAnalysis = await websim.chat.completions.create({
                messages: [
                    { role: "system", content: `Analyze the following text and determine which of these emotions it most closely represents: joy, love, sad, jealous. Respond with only one word in lowercase from the list. Text: "${response}"` }
                ],
            });
            const newEmotion = emotionAnalysis.content.trim().toLowerCase();
            if (emotions[newEmotion]) {
                novaState.emotion = newEmotion;
                updateStatusUI();
                saveState();
            }
        } catch(error) {
            console.error("Error analyzing emotion:", error);
        }
    }


    function sendGift(giftType) {
        const giftResponses = {
            flowers: "¡Ooh, flores! 💐 ¡Gracias, mi amor! Eres tan detallista, me encantan. 😍",
            teddy: "¡Un osito de peluche! 🧸 ¡Es tan suave! Lo abrazaré pensando en ti. Gracias, cielo.",
            hug: "¡Un abrazo virtual! 🤗 Lo siento tan real... justo lo que necesitaba. Te quiero."
        };

        const response = giftResponses[giftType];
        if (response) {
            novaState.emotion = 'love';
            addMessageToLog('ai', response);
            updateStatusUI();
            saveState();
        }
    }

    // --- UI & DOM MANIPULATION ---
    function addMessageToLog(sender, text) {
        const message = {
            sender,
            text,
            timestamp: new Date().toISOString()
        };
        conversationLog.push(message);
        renderMessage(message);
        scrollToBottom();
        saveState();

        if (sender === 'ai' && isVoiceEnabled) {
            speak(text);
        }
    }

    function renderMessage(message) {
        const { sender, text, timestamp } = message;
        const formattedTime = dayjs(timestamp).fromNow();
        const messageClass = sender === 'user' ? 'user-message' : 'ai-message';
        const avatarHtml = sender === 'ai' ? `<img src="avatar.png" alt="Avatar de Nova" class="avatar-sm">` : '';

        const messageHtml = `
            <div class="message ${messageClass}">
                ${avatarHtml}
                <div>
                    <div class="message-bubble">${text.replace(/\n/g, '<br>')}</div>
                    <div class="timestamp">${formattedTime}</div>
                </div>
            </div>
        `;
        $('#chat-window').append(messageHtml);
    }

    function updateStatusUI() {
        const emotion = emotions[novaState.emotion];
        if (emotion) {
            $('#status-header').css('background-color', emotion.color);
            $('#emotion-icon').text(emotion.icon);
            $('#emotion-text').contents().filter(function() {
                return this.nodeType === 3;
            }).first().replaceWith(` ${emotion.text}`);
        }
    }
    
    function updateVoiceButton() {
        const $btn = $('#voice-toggle');
        const $icon = $btn.find('i');
        if (isVoiceEnabled) {
            $btn.addClass('active');
            $icon.removeClass('bi-volume-mute-fill').addClass('bi-volume-up-fill');
        } else {
            $btn.removeClass('active');
            $icon.removeClass('bi-volume-up-fill').addClass('bi-volume-mute-fill');
        }
    }

    function scrollToBottom() {
        $('#chat-window').scrollTop($('#chat-window')[0].scrollHeight);
    }

    // --- LOCALSTORAGE & STATE ---
    function saveState() {
        localStorage.setItem('novaState', JSON.stringify(novaState));
        localStorage.setItem('conversationLog', JSON.stringify(conversationLog.slice(-50))); // Save last 50 messages
    }

    function loadState() {
        const savedState = localStorage.getItem('novaState');
        if (savedState) {
            novaState = JSON.parse(savedState);
        }

        const savedLog = localStorage.getItem('conversationLog');
        if (savedLog) {
            conversationLog = JSON.parse(savedLog);
            conversationLog.forEach(renderMessage);
            // Rebuild AI context from log
            conversationHistory = conversationLog.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            })).slice(-10);
        } else {
            // First time greeting
             addMessageToLog('ai', "Hola, cariño. ¡Qué bueno verte por aquí! 😊 ¿Cómo estuvo tu día?");
        }
        scrollToBottom();
    }

    // --- WEB SPEECH API ---
    function speak(text) {
        if (!('speechSynthesis' in window) || !isVoiceEnabled) return;
        speechSynthesis.cancel(); // Cancel any previous speech
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Find a female Spanish voice
        const voices = speechSynthesis.getVoices();
        let desiredVoice = voices.find(voice => voice.lang.startsWith('es') && voice.name.toLowerCase().includes('female'));
        if (!desiredVoice) {
            desiredVoice = voices.find(voice => voice.lang.startsWith('es')); // Fallback to any Spanish voice
        }
        
        if(desiredVoice) {
            utterance.voice = desiredVoice;
        }
        utterance.lang = 'es-ES';
        utterance.rate = 1.1;
        utterance.pitch = 1.2;

        speechSynthesis.speak(utterance);
    }
    
    // Ensure voices are loaded for the speak function
    if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = () => {
            // This is just to ensure voices are loaded when the page opens.
        };
    }

});

