import useSpeechToText from './js/useSpeechToText';
import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from "react-markdown"
import rehypeRaw from 'rehype-raw'
import ChatBubble from "@cloudscape-design/chat-components/chat-bubble";
import Avatar from "@cloudscape-design/chat-components/avatar";
import LoadingBar from "@cloudscape-design/chat-components/loading-bar";
import LiveRegion from "@cloudscape-design/components/live-region";
import Box from "@cloudscape-design/components/box";
import {
  Container,
  Form,
  FormField,
  PromptInput,
  Button,
  Modal,
  SpaceBetween,
  TopNavigation,
  Input,
  SideNavigation,
  Badge
} from "@cloudscape-design/components";
import PropTypes from 'prop-types';
import * as AWSAuth from '@aws-amplify/auth';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } from "@aws-sdk/client-bedrock-agentcore";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { useTheme } from './context/ThemeContext'; // Import useTheme hook
import './ChatComponent.css';





const ChatComponent = ({ user, onLogout, onConfigEditorClick }) => {
  const [bedrockClient, setBedrockClient] = useState(null);
  const [lambdaClient, setLambdaClient] = useState(null);
  const [agentCoreClient, setAgentCoreClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);
  const [isAgentResponding, setIsAgentResponding] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [agentName, setAgentName] = useState({ value: 'Agent' });
  const [tasksCompleted, setTasksCompleted] = useState({ count: 0, latestRationale: '' });
  const [isStrandsAgent, setIsStrandsAgent] = useState(false);
  const [isAgentCoreAgent, setIsAgentCoreAgent] = useState(false);
  const [userRole, setUserRole] = useState('cliente');

  // NUOVI STATE per gestione chat salvate
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [chatName, setChatName] = useState('');
  const [savedChats, setSavedChats] = useState([]);
  const [showSavedChatsPanel, setShowSavedChatsPanel] = useState(false);
  const [currentChatName, setCurrentChatName] = useState(null);
  
  // Get theme context
  const { theme, toggleTheme } = useTheme();

  const getUserKey = useCallback((key) => {
    return `user_${user.username}_${key}`;
  }, [user.username]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleClearData = () => {
    setShowClearDataModal(true);
  };

const { transcript, isListening, startListening, stopListening, speechRecognitionSupported, language, changeLanguage } = useSpeechToText();
  
  useEffect(() => {
    if (transcript) {
      setNewMessage(transcript.trim());
      scrollToBottom();
    }
  }, [transcript]);

  const confirmClearData = () => {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`user_${user.username}_`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    window.location.reload();
  };

  // NUOVA FUNZIONE: Carica la lista delle chat salvate
  const loadSavedChatsList = useCallback(() => {
    const savedChatsData = localStorage.getItem(getUserKey('savedChats'));
    if (savedChatsData) {
      setSavedChats(JSON.parse(savedChatsData));
    }
  }, [getUserKey]);

  // NUOVA FUNZIONE: Salva la chat corrente con un nome
  const saveCurrentChat = () => {
    if (!chatName.trim()) {
      alert('Inserisci un nome per la chat');
      return;
    }

    const chatData = {
      id: sessionId,
      name: chatName.trim(),
      messages: messages,
      savedAt: new Date().toISOString(),
      messageCount: messages.length
    };

    // Aggiorna la lista delle chat salvate
    const updatedSavedChats = [...savedChats, chatData];
    setSavedChats(updatedSavedChats);
    
    // Salva nel localStorage
    localStorage.setItem(getUserKey('savedChats'), JSON.stringify(updatedSavedChats));
    localStorage.setItem(getUserKey(`chat_${sessionId}`), JSON.stringify(chatData));

    setCurrentChatName(chatName.trim());
    setShowSaveModal(false);
    setChatName('');
    
    console.log('Chat salvata:', chatData.name);
  };

  // NUOVA FUNZIONE: Carica una chat salvata
  const loadSavedChat = (chatData) => {
    setSessionId(chatData.id);
    setMessages(chatData.messages);
    setCurrentChatName(chatData.name);
    setShowSavedChatsPanel(false);
    
    localStorage.setItem(getUserKey('lastSessionId'), chatData.id);
    console.log('Chat caricata:', chatData.name);
  };

  // NUOVA FUNZIONE: Elimina una chat salvata
  const deleteSavedChat = (chatId) => {
    const updatedSavedChats = savedChats.filter(chat => chat.id !== chatId);
    setSavedChats(updatedSavedChats);
    
    localStorage.setItem(getUserKey('savedChats'), JSON.stringify(updatedSavedChats));
    localStorage.removeItem(getUserKey(`chat_${chatId}`));
    
    console.log('Chat eliminata:', chatId);
  };

  const createNewSession = useCallback(() => {
    const newSessionId = `agentcore-session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;
    setSessionId(newSessionId);
    setMessages([]);
    setCurrentChatName(null);
    localStorage.setItem(getUserKey('lastSessionId'), newSessionId);
    localStorage.setItem(getUserKey(`messages_${newSessionId}`), JSON.stringify([]));
    console.log('New session created for user:', user.username, 'Session:', newSessionId);
  }, [getUserKey, user.username]);

  const fetchMessagesForSession = useCallback((sessionId) => {
    const storedMessages = localStorage.getItem(getUserKey(`messages_${sessionId}`));
    return storedMessages ? JSON.parse(storedMessages) : [];
  }, [getUserKey]);

  const storeMessages = useCallback((sessionId, newMessages) => {
    const currentMessages = fetchMessagesForSession(sessionId);
    const updatedMessages = [...currentMessages, ...newMessages];
    localStorage.setItem(getUserKey(`messages_${sessionId}`), JSON.stringify(updatedMessages));
  }, [fetchMessagesForSession, getUserKey]);

  const loadExistingSession = useCallback(() => {
    const lastSessionId = localStorage.getItem(getUserKey('lastSessionId'));
    if (lastSessionId) {
      setSessionId(lastSessionId);
      const loadedMessages = fetchMessagesForSession(lastSessionId);
      setMessages(loadedMessages);
      console.log('Loaded existing session for user:', user.username, 'Session:', lastSessionId);
    } else {
      createNewSession();
    }
  }, [createNewSession, fetchMessagesForSession, getUserKey, user.username]);

  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        const appConfig = JSON.parse(localStorage.getItem('appConfig'));
        const bedrockConfig = appConfig.bedrock;
        const strandsConfig = appConfig.strands;
        
        setIsStrandsAgent(strandsConfig && strandsConfig.enabled);
        
        const agentCoreConfig = appConfig.agentcore;
        setIsAgentCoreAgent(agentCoreConfig && agentCoreConfig.enabled);
        
        const session = await AWSAuth.fetchAuthSession();
        
        const userAttributes = await AWSAuth.fetchUserAttributes();
        const ruolo = userAttributes['custom:ruolo'] || 'cliente';
        setUserRole(ruolo);
        console.log('Ruolo utente caricato:', ruolo);
        
        if (!strandsConfig?.enabled && !agentCoreConfig?.enabled) {
          const newBedrockClient = new BedrockAgentRuntimeClient({
            region: bedrockConfig.region,
            credentials: session.credentials
          });
          setBedrockClient(newBedrockClient);
          if (bedrockConfig.agentName && bedrockConfig.agentName.trim()) {
            setAgentName({ value: bedrockConfig.agentName });
          }
        } 
        else if (strandsConfig && strandsConfig.enabled && !agentCoreConfig?.enabled) {
          const newLambdaClient = new LambdaClient({
            region: strandsConfig.region,
            credentials: session.credentials
          });
          setLambdaClient(newLambdaClient);
          if (strandsConfig.agentName && strandsConfig.agentName.trim()) {
            setAgentName({ value: strandsConfig.agentName });
          }
        }

        if (agentCoreConfig && agentCoreConfig.enabled && agentCoreConfig.region) {
          const newAgentCoreClient = new BedrockAgentCoreClient({
            region: agentCoreConfig.region,
            credentials: session.credentials
          });
          setAgentCoreClient(newAgentCoreClient);
          if (agentCoreConfig.agentName && agentCoreConfig.agentName.trim()) {
            setAgentName({ value: agentCoreConfig.agentName });
          }
        }
      } catch (error) {
        console.error('Error fetching credentials:', error);
      }
    };

    fetchCredentials();
    loadSavedChatsList(); // Carica la lista delle chat salvate all'avvio
  }, [loadSavedChatsList]);

  useEffect(() => {
    if ((bedrockClient || lambdaClient || agentCoreClient) && !sessionId) {
      loadExistingSession();
    }
  }, [bedrockClient, lambdaClient, agentCoreClient, sessionId, loadExistingSession]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newMessage.trim() && sessionId) {
      const appConfig = JSON.parse(localStorage.getItem('appConfig'));
      
      setNewMessage('');
      const userMessage = { text: newMessage, sender: user.username };
      setMessages(prevMessages => [...prevMessages, userMessage]);
      setIsAgentResponding(true);

      try {
        let agentMessage;
        
        if (!isStrandsAgent && bedrockClient) {
          const bedrockConfig = appConfig.bedrock;
          
          const userAttributes = await AWSAuth.fetchUserAttributes();
          const ruolo = userAttributes['custom:ruolo'] || 'cliente';
          const nomeCliente = userAttributes['custom:nomeCliente'] || null;
          
          if (ruolo !== 'admin' && !nomeCliente) {
            throw new Error('Attributo nomeCliente non trovato per questo utente. Contatta l\'amministratore.');
          }
          
          console.log('Ruolo utente:', ruolo);
          console.log('Nome cliente:', nomeCliente);
          
          const sessionAttributes = {
            ruolo: ruolo,
            nomeCliente: nomeCliente || ''
          };

          const command = new InvokeAgentCommand({
            agentId: bedrockConfig.agentId,
            agentAliasId: bedrockConfig.agentAliasId,
            sessionId: sessionId,
            endSession: false,
            enableTrace: true,
            inputText: newMessage,
            sessionState: {
              sessionAttributes: sessionAttributes
            }
          });

          let completion = "";
          const response = await bedrockClient.send(command);

          if (response.completion === undefined) {
            throw new Error("Completion is undefined");
          }

          for await (const chunkEvent of response.completion) {
            if (chunkEvent.trace) {
              console.log("Trace: ", chunkEvent.trace);
              tasksCompleted.count++;
              if (typeof (chunkEvent.trace.trace.failureTrace) !== 'undefined') {
                throw new Error(chunkEvent.trace.trace.failureTrace.failureReason);
              }

              if (chunkEvent.trace.trace.orchestrationTrace.rationale) {
                tasksCompleted.latestRationale = chunkEvent.trace.trace.orchestrationTrace.rationale.text;
                scrollToBottom();
              }
              setTasksCompleted({ ...tasksCompleted });

            } else if (chunkEvent.chunk) {
              const chunk = chunkEvent.chunk;
              const decodedResponse = new TextDecoder("utf-8").decode(chunk.bytes);
              completion += decodedResponse;
            }
          }

          console.log('Full completion:', completion);
          agentMessage = { text: completion, sender: agentName.value };
        } 
        else if (isStrandsAgent && lambdaClient) {
          const strandsConfig = appConfig.strands;
          
          const payload = {
            query: newMessage
          };
          
          const lambdaArn = strandsConfig.lambdaArn;
          
          const command = new InvokeCommand({
            FunctionName: lambdaArn,
            Payload: JSON.stringify(payload),
            InvocationType: 'RequestResponse'
          });
          
          const response = await lambdaClient.send(command);
          
          const responseBody = new TextDecoder().decode(response.Payload);
          const parsedResponse = JSON.parse(responseBody);
          
          console.log('Lambda response:', parsedResponse);
          
          let responseText;
          if (parsedResponse.body) {
            const body = JSON.parse(parsedResponse.body);
            responseText = body.response;
          } else if (parsedResponse.response) {
            responseText = parsedResponse.response;
          } else {
            responseText = "Sorry, I couldn't process your request.";
          }
          
          agentMessage = { text: responseText, sender: agentName.value };
        }
        else if (isAgentCoreAgent && agentCoreClient) {
          const agentCoreConfig = appConfig.agentcore;
          
          const command = new InvokeAgentRuntimeCommand({
            agentRuntimeArn: agentCoreConfig.agentArn,
            runtimeSessionId: sessionId,
            payload: JSON.stringify({ prompt: newMessage })
          });

          const response = await agentCoreClient.send(command);
          
          let responseBody = '';
          if (response.response && response.response.getReader) {
            const reader = response.response.getReader();
            const decoder = new TextDecoder();
            let done = false;
            
            while (!done) {
              const { value, done: streamDone } = await reader.read();
              done = streamDone;
              if (value) {
                responseBody += decoder.decode(value, { stream: true });
              }
            }
          } else {
            responseBody = response.response || '';
          }
          
          console.log('AgentCore raw response:', responseBody);
          
          const parsedResponse = JSON.parse(responseBody);
          const responseText = parsedResponse.result || "Sorry, I couldn't process your request.";
          agentMessage = { text: responseText, sender: agentName.value };
        } else {
          throw new Error("No agent client available");
        }

        setMessages(prevMessages => [...prevMessages, agentMessage]);
        storeMessages(sessionId, [userMessage, agentMessage]);

      } catch (err) {
        console.error('Error invoking agent:', err);

        let errReason = "**"+String(err).toString()+"**";

        const errorMessage = { text: `An error occurred while processing your request:\n${errReason}`, sender: 'agent' };
        setMessages(prevMessages => [...prevMessages, errorMessage]);
        storeMessages(sessionId, [userMessage, errorMessage]);
      } finally {
        setIsAgentResponding(false);
        setTasksCompleted({ count: 0, latestRationale: '' });
      }
    }
  };

  const handleLogout = async () => {
    try {
      await AWSAuth.signOut();
      onLogout();
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  return (
    <div className="chat-component">
      <Container stretch>
        <div className="chat-container">
          <TopNavigation
            identity={{
              href: "#",
              title: `Chat with ${agentName.value}${userRole === 'admin' ? ' 👑 [ADMIN]' : ''}${currentChatName ? ` - ${currentChatName}` : ''}`,
            }}
            utilities={
              [
                {
                  type: "button",
                  text: "🗑️",  // Emoji cestino
                  title: "Start a new conversation",
                  ariaLabel: "Start a new conversation",
                  disableUtilityCollapse: true,
                  onClick: () => createNewSession()
                },
                // Theme toggle button
                {
                type: "button",
                text: theme === 'light' ? "🌙" : "☀️",
                title: theme === 'light' ? "Switch to dark mode" : "Switch to light mode",
                ariaLabel: theme === 'light' ? "Switch to dark mode" : "Switch to light mode",
                disableUtilityCollapse: true,
                onClick: toggleTheme
              },
                // NUOVO: Bottone per salvare la chat
                {
                  type: "button",
                  iconName: "download",
                  title: "Save current chat",
                  ariaLabel: "Save current chat",
                  disableUtilityCollapse: true,
                  disabled: messages.length === 0,
                  onClick: () => setShowSaveModal(true)
                },
                // NUOVO: Bottone per vedere le chat salvate
                {
                  type: "button",
                  iconName: "folder",
                  title: "Saved chats",
                  ariaLabel: "Saved chats",
                  disableUtilityCollapse: true,
                  onClick: () => setShowSavedChatsPanel(!showSavedChatsPanel)
                },
                ...(userRole === 'admin' ? [{
                  type: "menu-dropdown",
                  iconName: "settings",
                  ariaLabel: "Settings",
                  title: "Settings",
                  disableUtilityCollapse: true,
                  onItemClick: ({ detail }) => {
                    switch (detail.id) {
                      case "edit-settings":
                        onConfigEditorClick();
                        break;
                      case "clear-settings":
                        handleClearData();
                        break;
                    }
                  },
                  items: [
                    {
                      id: "clear-settings",
                      type: "button",
                      iconName: "remove",
                      text: "Clear settings and chat history",
                    },
                    {
                      id: "edit-settings",
                      text: "Edit Settings",
                      iconName: "edit",
                      type: "icon-button",
                    }
                  ]
                }] : []),
                {
                  type: "menu-dropdown",
                  text: user.username,
                  iconName: "user-profile",
                  title: user.username,
                  ariaLabel: "User",
                  disableUtilityCollapse: true,
                  onItemClick: ({ detail }) => {
                    switch (detail.id) {
                      case "logout":
                        handleLogout();
                        break;
                    }
                  },
                  items: [
                    {
                      id: "logout",
                      text: "Logout",
                      iconName: "exit",
                      type: "icon-button",
                    }
                  ]
                }
              ]
            }
          />

          {/* NUOVO: Pannello laterale per le chat salvate */}
          {showSavedChatsPanel && (
            <div style={{ 
              position: 'absolute', 
              right: 0, 
              top: '50px', 
              width: '300px', 
              height: 'calc(100% - 50px)', 
              backgroundColor: theme === 'dark' ? '#2a2a2a' : 'white', 
              color: theme === 'dark' ? '#fff' : '#000',
              borderLeft: `1px solid ${theme === 'dark' ? '#555' : '#ccc'}`,
              overflowY: 'auto',
              zIndex: 1000,
              padding: '10px'
            }}>
              <h3>Saved Chats ({savedChats.length})</h3>
              {savedChats.length === 0 ? (
                <p style={{ color: theme === 'dark' ? '#aaa' : '#666', fontSize: '14px' }}>No saved chats yet</p>
              ) : (
                savedChats.map((chat) => (
                  <div key={chat.id} style={{ 
                    border: `1px solid ${theme === 'dark' ? '#555' : '#ddd'}`, 
                    borderRadius: '4px', 
                    padding: '10px', 
                    marginBottom: '10px',
                    cursor: 'pointer',
                    backgroundColor: theme === 'dark' ? '#333' : '#fff',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div onClick={() => loadSavedChat(chat)} style={{ flex: 1 }}>
                        <strong>{chat.name}</strong>
                        <br />
                        <small style={{ color: theme === 'dark' ? '#aaa' : '#666' }}>
                          {chat.messageCount} messages
                          <br />
                          {new Date(chat.savedAt).toLocaleString()}
                        </small>
                      </div>
                      <Button 
                        variant="icon" 
                        iconName="remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${chat.name}"?`)) {
                            deleteSavedChat(chat.id);
                          }
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="messages-container scrollable">
            {messages.map((message, index) => (
              <div key={index}>
                <ChatBubble
                  ariaLabel={`${message.sender} message`}
                  type={message.sender === user.username ? "outgoing" : "incoming"}
                  avatar={
                    <Avatar
                      ariaLabel={message.sender}
                      tooltipText={message.sender}
                      color={message.sender === user.username ? "default" : "gen-ai"}
                      initials={message.sender.substring(0, 2).toUpperCase()}
                    />
                  }
                >
                  {message.text.split('\n').map((line, i) => (
                    <ReactMarkdown
                      key={'md-rendering' + i}
                      rehypePlugins={[rehypeRaw]}
                    >
                      {line}
                    </ReactMarkdown>
                  ))}
                </ChatBubble>
              </div>
            ))}
            <div ref={messagesEndRef} />
            {isAgentResponding && (
              <LiveRegion>
                <Box
                  margin={{ bottom: "xs", left: "l" }}
                  color="text-body-secondary"
                >
                  {!isStrandsAgent && tasksCompleted.count > 0 && (
                    <div>
                      {agentName.value} is working on your request | Tasks completed ({tasksCompleted.count})
                      <br />
                      <i>{tasksCompleted.latestRationale}</i>
                    </div>
                  )}
                  {isStrandsAgent && (
                    <div>
                      {agentName.value} is processing your request...
                    </div>
                  )}
                  <LoadingBar variant="gen-ai" />
                </Box>
              </LiveRegion>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="message-form">
  <Form>
    <FormField stretch>
      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        {speechRecognitionSupported && (
          <>
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              title={isListening ? "Stop Listening" : "Start Listening"}
              className="mic-button"
              style={{
                background: 'none',
                border: 'none',
                margin: '0 8px 0 0',
                padding: '4px',
                cursor: 'pointer'
              }}
            >
              {isListening ? (
                <svg xmlns="http://www.w3.org/2000/svg" height="28" width="28" fill="red" viewBox="0 0 24 24">
                  <path d="M12 14q-1.25 0-2.125-.875T9 11V5q0-1.25.875-2.125T12 2q1.25 0 2.125.875T15 5v6q0 1.25-.875 2.125T12 14Zm-1 7v-3.1q-2.875-.35-4.437-2.35Q5 13.55 5 11h2q0 2.075 1.463 3.538Q9.925 16 12 16q2.075 0 3.538-1.462Q17 13.075 17 11h2q0 2.55-1.563 4.55-1.562 2-4.437 2.35V21Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" height="28" width="28" fill={theme === 'dark' ? 'white' : 'black'} viewBox="0 0 24 24">
                  <path d="M12 14q-1.25 0-2.125-.875T9 11V5q0-1.25.875-2.125T12 2q1.25 0 2.125.875T15 5v6q0 1.25-.875 2.125T12 14Zm-1 7v-3.1q-2.875-.35-4.437-2.35Q5 13.55 5 11h2q0 2.075 1.463 3.538Q9.925 16 12 16q2.075 0 3.538-1.462Q17 13.075 17 11h2q0 2.55-1.563 4.55-1.562 2-4.437 2.35V21Z" />
                </svg>
              )}
            </button>
            
            {/* Selettore della lingua per il riconoscimento vocale */}
            <div 
              style={{ 
                marginRight: '10px', 
                fontSize: '12px', 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: theme === 'dark' ? '#333' : '#f0f0f0',
              }}
              onClick={() => {
                const newLang = language === 'en-US' ? 'it-IT' : 'en-US';
                changeLanguage(newLang);
              }}
              title={`Current language: ${language === 'en-US' ? 'English' : 'Italian'}. Click to change.`}
            >
              {language === 'en-US' ? '🇺🇸' : '🇮🇹'}
            </div>
          </>
        )}
        
        <div style={{ flex: 1 }}>
          <PromptInput
            type='text'
            value={newMessage}
            onChange={({ detail }) => setNewMessage(detail.value)}
            placeholder='Type your question here...'
            actionButtonAriaLabel="Send message"
            actionButtonIconName="send"
          />
        </div>
      </div>
    </FormField>
  </Form>
</form>

          {/* Modal per salvare la chat */}
          <Modal
            onDismiss={() => {
              setShowSaveModal(false);
              setChatName('');
            }}
            visible={showSaveModal}
            header="Save Chat"
            footer={
              <Box float="right">
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="link" onClick={() => {
                    setShowSaveModal(false);
                    setChatName('');
                  }}>Cancel</Button>
                  <Button variant="primary" onClick={saveCurrentChat}>Save</Button>
                </SpaceBetween>
              </Box>
            }
          >
            <FormField label="Chat name">
              <Input
                value={chatName}
                onChange={({ detail }) => setChatName(detail.value)}
                placeholder="Enter a name for this chat"
              />
            </FormField>
          </Modal>

          {/* Modal per conferma eliminazione */}
          <Modal
            onDismiss={() => setShowClearDataModal(false)}
            visible={showClearDataModal}
            header="Confirm clearing data"
            footer={
              <Box float="right">
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="link" onClick={() => setShowClearDataModal(false)}>Cancel</Button>
                  <Button variant="primary" onClick={confirmClearData}>Ok</Button>
                </SpaceBetween>
              </Box>
            }
          >
            <strong>This action cannot be undone.</strong> Your chat history with {agentName.value} will be permanently deleted. Do you want to continue?
          </Modal>
        </div>
      </Container>
    </div>
  );
};

ChatComponent.propTypes = {
  user: PropTypes.object.isRequired,
  onLogout: PropTypes.func.isRequired,
  onConfigEditorClick: PropTypes.func.isRequired
};

export default ChatComponent;