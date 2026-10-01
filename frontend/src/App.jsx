import { useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [numQuestions, setNumQuestions] = useState("5");
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const [loading, setLoading] = useState(false);

  const handleUploadAndGenerate = async () => {
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }
    
    setLoading(true);
    setError('');
    setQuiz(null);
    setScore(null);
    setAnswers({});

    try {
      // 1. Upload PDF
      const formData = new FormData();
      formData.append('file', file);
      await axios.post('http://localhost:8000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // 2. Generate Quiz
      const res = await axios.post('http://localhost:8000/generate-quiz', {
        num_questions: numQuestions
      });
      
      setQuiz(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (questionIndex, optionIndex) => {
    setAnswers({
      ...answers,
      [questionIndex]: optionIndex
    });
  };

  const handleSubmitQuiz = () => {
    let calculatedScore = 0;
    quiz.questions.forEach((q, qIndex) => {
      const selectedOptionIndex = answers[qIndex];
      if (selectedOptionIndex !== undefined) {
        if (q.options[selectedOptionIndex].is_correct) {
          calculatedScore += 1;
        }
      }
    });
    setScore(calculatedScore);
  };

  const getReviewMessage = (score, total) => {
    const percentage = score / total;
    if (percentage === 1) return "Perfect! You have mastered this material flawlessly.";
    if (percentage >= 0.8) return "Excellent work! You have a very strong understanding of the topic.";
    if (percentage >= 0.6) return "Good job! You've got the basics down, but reviewing a few concepts might help.";
    if (percentage >= 0.4) return "Fair effort! You might want to re-read the document and try again.";
    return "Don't get discouraged! Take some time to study the material closely before your next attempt.";
  };

  return (
    <div className="App" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>PDF MCQ Quiz Generator</h1>
      
      <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3>1. Upload & Generate</h3>
        <input type="file" accept=".pdf" onChange={handleFileChange} style={{ display: 'block', margin: '10px 0' }} />
        
        <label style={{ display: 'block', margin: '10px 0', fontWeight: 'bold' }}>
          Number of Questions: 
          <select 
            value={numQuestions}
            onChange={(e) => setNumQuestions(e.target.value)}
            style={{ 
              marginLeft: '15px', 
              padding: '10px 12px', 
              width: '180px',
              borderRadius: '6px',
              border: '1px solid #b3b3b3',
              backgroundColor: 'transparent',
              color: 'white',
              fontSize: '15px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}
          >
            <option value="5" style={{ backgroundColor: '#242424', color: 'white' }}>5 Questions</option>
            <option value="5-10" style={{ backgroundColor: '#242424', color: 'white' }}>5 to 10 Questions</option>
            <option value="10-15" style={{ backgroundColor: '#242424', color: 'white' }}>10 to 15 Questions</option>
            <option value="15-20" style={{ backgroundColor: '#242424', color: 'white' }}>15 to 20 Questions</option>
          </select>
        </label>
        <button onClick={handleUploadAndGenerate} disabled={loading || !file} style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #b3b3b3', color: 'black', borderRadius: '6px' }}>
          {loading ? 'Processing & Generating...' : 'Generate Quiz'}
        </button>
        {error && <p style={{ color: 'red', marginTop: '15px', fontWeight: 'bold' }}>{error}</p>}
      </div>

      {quiz && (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h3>2. Take the Quiz</h3>
          {quiz.questions.map((q, qIndex) => (
            <div key={qIndex} style={{ marginBottom: '20px', textAlign: 'left' }}>
              <p><strong>Q{qIndex + 1}: {q.question}</strong></p>
              {q.options.map((opt, oIndex) => (
                <div key={oIndex}>
                  <label>
                    <input 
                      type="radio" 
                      name={`question-${qIndex}`} 
                      checked={answers[qIndex] === oIndex}
                      onChange={() => handleOptionSelect(qIndex, oIndex)}
                      disabled={score !== null}
                    />
                    {opt.text}
                  </label>
                  {score !== null && opt.is_correct && <span style={{ color: 'green', marginLeft: '10px' }}>✓ Correct Option</span>}
                  {score !== null && answers[qIndex] === oIndex && !opt.is_correct && <span style={{ color: 'red', marginLeft: '10px' }}>✗ Your Answer</span>}
                </div>
              ))}
            </div>
          ))}
          
          {score === null ? (
            <button onClick={handleSubmitQuiz} style={{ padding: '10px 20px', marginTop: '20px' }}>
              Submit Answers
            </button>
          ) : (
            <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#e6ffe6', borderRadius: '8px' }}>
              <h2 style={{ color: 'black' }}>Your Score: {score} / {quiz.questions.length}</h2>
              <p style={{ fontSize: '1.2em', margin: '15px 0', color: 'black' }}>
                {getReviewMessage(score, quiz.questions.length)}
              </p>
              <button onClick={() => { setScore(null); setAnswers({}); }} style={{ padding: '10px 20px', marginTop: '10px' }}>
                Retake Quiz
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
