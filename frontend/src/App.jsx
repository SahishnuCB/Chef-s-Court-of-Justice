import React, { useState, useEffect } from "react";
import api from "./api";

function App() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "DEFENDANT",
  });
  const [cases, setCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [newCase, setNewCase] = useState({
    title: "",
    argument: "",
    evidenceText: "",
  });
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [message, setMessage] = useState("");
  const [voteVerdict, setVoteVerdict] = useState("GUILTY");
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [results, setResults] = useState(null);
  const [judgeFilter, setJudgeFilter] = useState("ALL"); // ALL | PENDING | APPROVED | REJECTED

  useEffect(() => {
    if (user) {
      fetchCases();
    }
  }, [user]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleNewCaseChange = (e) => {
    setNewCase({ ...newCase, [e.target.name]: e.target.value });
  };

  const resetMessages = () => {
    setMessage("");
    setResults(null);
    setSelectedCaseId(null);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    resetMessages();
    try {
      await api.post("/auth/signup", {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      setMessage("Signup successful! Now login.");
      setAuthMode("login");
    } catch (err) {
      setMessage(err.response?.data?.message || "Signup failed");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    resetMessages();
    try {
      const res = await api.post("/auth/login", {
        email: form.email,
        password: form.password,
      });
      const { token, user } = res.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);
      setMessage("Logged in successfully");
    } catch (err) {
      setMessage(err.response?.data?.message || "Login failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setCases([]);
    setSelectedCaseId(null);
    setResults(null);
  };

  const fetchCases = async () => {
    resetMessages();
    setLoadingCases(true);
    try {
      const res = await api.get("/case/all");
      setCases(res.data);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to fetch cases");
    } finally {
      setLoadingCases(false);
    }
  };

  const submitCase = async (e) => {
    e.preventDefault();
    resetMessages();
    try {
      const formData = new FormData();
      formData.append("title", newCase.title);
      formData.append("argument", newCase.argument);
      formData.append("evidenceText", newCase.evidenceText);
      if (evidenceFile) {
        formData.append("evidenceFile", evidenceFile);
      }
      await api.post("/case/submit", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("Case submitted successfully (awaiting judge approval)");
      setNewCase({ title: "", argument: "", evidenceText: "" });
      setEvidenceFile(null);
      fetchCases();
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to submit case");
    }
  };

  const judgeAction = async (id, action) => {
    resetMessages();
    try {
      await api.patch(`/case/${action}/${id}`);
      setMessage(`Case ${action}d successfully`);
      fetchCases();
    } catch (err) {
      setMessage(err.response?.data?.message || `Failed to ${action} case`);
    }
  };

  const deleteCase = async (id) => {
    resetMessages();
    try {
      await api.delete(`/case/delete/${id}`);
      setMessage("Case deleted");
      fetchCases();
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to delete case");
    }
  };

  const castVote = async (id) => {
    resetMessages();
    if (!id) return;
    try {
      await api.post(`/jury/vote/${id}`, { verdict: voteVerdict });
      setMessage("Vote submitted");
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to vote");
    }
  };

  const fetchResults = async (id) => {
    resetMessages();
    if (!id) return;
    try {
      const res = await api.get(`/jury/results/${id}`);
      setResults(res.data);
      setSelectedCaseId(id);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to fetch results");
    }
  };

  const renderCasesTable = (list = cases) => (
    <table className="cases-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Argument</th>
          <th>Evidence</th>
          <th>Status</th>
          <th>Submitted By</th>
          {user?.role === "JUDGE" && <th>Actions</th>}
          {user?.role === "JUROR" && <th>Vote / Results</th>}
        </tr>
      </thead>
      <tbody>
        {list.map((c) => (
          <tr key={c.id}>
            <td>{c.id}</td>
            <td>{c.title}</td>
            <td className="cell-long">{c.argument}</td>
            <td className="cell-long">{c.evidenceText}</td>
            <td>{c.status}</td>
            <td>
              {c.submittedBy?.name} ({c.submittedBy?.role})
            </td>
            {user?.role === "JUDGE" && (
              <td>
                <div className="judge-actions">
                  <button
                    type="button"
                    className="btn-approve"
                    onClick={() => judgeAction(c.id, "approve")}
                  >
                    ✔ Approve
                  </button>
                  <button
                    type="button"
                    className="btn-reject"
                    onClick={() => judgeAction(c.id, "reject")}
                  >
                    ✖ Reject
                  </button>
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={() => deleteCase(c.id)}
                  >
                    🗑 Delete
                  </button>
                  <button type="button" onClick={() => fetchResults(c.id)}>
                    📊 Results
                  </button>
                </div>
              </td>
            )}
            {user?.role === "JUROR" && (
              <td>
                <div className="vote-section">
                  <select
                    value={voteVerdict}
                    onChange={(e) => setVoteVerdict(e.target.value)}
                  >
                    <option value="GUILTY">Guilty</option>
                    <option value="NOT_GUILTY">Not Guilty</option>
                  </select>
                  <button
                    onClick={() => {
                      setSelectedCaseId(c.id);
                      castVote(c.id);
                    }}
                  >
                    Vote
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCaseId(c.id);
                      fetchResults(c.id);
                    }}
                  >
                    View Results
                  </button>
                </div>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (!user) {
    return (
      <div className="container">
        <h1>Chef&apos;s Court of Justice</h1>
        <div className="card auth-card">
          <form
            onSubmit={authMode === "signup" ? handleSignup : handleLogin}
            className="form auth-form centered-form"
          >
            <input
              name="name"
              placeholder="Full Name"
              value={form.name}
              onChange={handleChange}
              required={authMode === "signup"}
            />
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
            />
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              required={authMode === "signup"}
            >
              <option value="DEFENDANT">Defendant</option>
              <option value="PLAINTIFF">Plaintiff</option>
              <option value="JUROR">Juror</option>
              <option value="JUDGE">Judge</option>
            </select>

            <div className="auth-toggle-row">
              <button
                type="button"
                className={`toggle-btn ${authMode === "login" ? "active" : ""}`}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={`toggle-btn ${
                  authMode === "signup" ? "active" : ""
                }`}
                onClick={() => setAuthMode("signup")}
              >
                Signup
              </button>
            </div>

            <button type="submit" className="primary-btn">
              {authMode === "signup" ? "Signup" : "Login"}
            </button>
          </form>

          {message && <div className="message">{message}</div>}
        </div>
      </div>
    );
  }

  const userCases = cases.filter((c) => c.submittedBy?.id === user.id);
  const filteredJudgeCases =
    judgeFilter === "ALL"
      ? cases
      : cases.filter((c) => c.status === judgeFilter);

  return (
    <div className="container">
      <header className="header">
        <h1>Chef&apos;s Court of Justice</h1>
        <div className="header-right">
          <span className="user-badge">
            {user.name} ({user.role})
          </span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {message && <div className="message">{message}</div>}

      {(user.role === "DEFENDANT" || user.role === "PLAINTIFF") && (
        <>
          <div className="card">
            <h2>Submit Case</h2>
            <form onSubmit={submitCase} className="form">
              <input
                name="title"
                placeholder="Case title"
                value={newCase.title}
                onChange={handleNewCaseChange}
                required
              />
              <textarea
                name="argument"
                placeholder="Argument"
                value={newCase.argument}
                onChange={handleNewCaseChange}
                required
              />
              <textarea
                name="evidenceText"
                placeholder="Evidence (plaintext)"
                value={newCase.evidenceText}
                onChange={handleNewCaseChange}
                required
              />
              <label>
                Evidence Document (optional):
                <input
                  type="file"
                  onChange={(e) => setEvidenceFile(e.target.files[0] || null)}
                />
              </label>
              <button type="submit">Submit Case</button>
            </form>
          </div>

          <div className="card">
            <h2>Your Cases</h2>
            {loadingCases ? (
              <p>Loading...</p>
            ) : userCases.length === 0 ? (
              <p>No cases submitted yet.</p>
            ) : (
              renderCasesTable(userCases)
            )}
          </div>
        </>
      )}

      {user.role === "JUDGE" && (
        <div className="card">
          <h2>All Cases</h2>

          <div className="filter-row">
            <button
              type="button"
              className={`filter-btn ${judgeFilter === "ALL" ? "active" : ""}`}
              onClick={() => setJudgeFilter("ALL")}
            >
              All
            </button>
            <button
              type="button"
              className={`filter-btn ${
                judgeFilter === "PENDING" ? "active" : ""
              }`}
              onClick={() => setJudgeFilter("PENDING")}
            >
              Pending
            </button>
            <button
              type="button"
              className={`filter-btn ${
                judgeFilter === "APPROVED" ? "active" : ""
              }`}
              onClick={() => setJudgeFilter("APPROVED")}
            >
              Approved
            </button>
            <button
              type="button"
              className={`filter-btn ${
                judgeFilter === "REJECTED" ? "active" : ""
              }`}
              onClick={() => setJudgeFilter("REJECTED")}
            >
              Rejected
            </button>
            <button type="button" onClick={fetchCases}>
              Refresh
            </button>
          </div>

          {loadingCases ? (
            <p>Loading...</p>
          ) : cases.length === 0 ? (
            <p>No cases.</p>
          ) : (
            renderCasesTable(filteredJudgeCases)
          )}
        </div>
      )}

      {user.role === "JUROR" && (
        <div className="card">
          <h2>Approved Cases (for Voting)</h2>
          <button onClick={fetchCases}>Refresh</button>
          {loadingCases ? (
            <p>Loading...</p>
          ) : cases.length === 0 ? (
            <p>No approved cases yet.</p>
          ) : (
            renderCasesTable()
          )}
        </div>
      )}

      {(user.role === "JUROR" || user.role === "JUDGE") &&
        results &&
        selectedCaseId && (
          <div className="results">
            <h3>Results for Case #{selectedCaseId}</h3>
            <p>Total votes: {results.totalVotes}</p>
            <p>Guilty: {results.guilty}</p>
            <p>Not Guilty: {results.notGuilty}</p>
          </div>
        )}
    </div>
  );
}

export default App;
