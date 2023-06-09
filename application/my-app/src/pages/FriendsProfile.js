import React, { useState, useEffect} from "react";
import './stylesheets/FriendsDetailPage.css'
import Banner from './stylesheets/UlingualBanner.png'
import { Link, useLocation } from "react-router-dom";
import queryString from 'query-string';
import axios from 'axios'

const FriendsProfile = () => {
    const location = useLocation();
    const queryParams = queryString.parse(location.search);
    const [userID, setUserID] = useState();
    const [username, setUsername] = useState();
    const [email, setEmail] = useState();
    const [nativeLanguage, setNative] = useState();
    const [learningLanguage, setLearning] = useState();
    const [description, setDescription] = useState();
    const [followers, setFollowers] = useState();
    const [userImage, setUserImage] = useState(null);
    const [following, setFollowing] = useState(true);

    const follow = (e) => {
        console.log(userID);
        e.preventDefault();
        axios.post(`https://50.18.108.83.nip.io:3001/friend/add`, {
        // axios.post(`http://localhost:3001/friend/add`, {
            username: username,
            UserID: userID
        })
        .then(res => {
            if(res.data.message) {
                alert(res.data.message);
                setFollowing(true);
            }
        })

    }

    useEffect(() => {
        if(queryParams.user) {
            axios.get(`https://50.18.108.83.nip.io:3001/friend/profile?user=${queryParams.user}`)
            // axios.get(`http://localhost:3001/friend/profile?user=${queryParams.user}`)
            .then(res => {
                console.log(res.data);
                setUserID(res.data.UserID);
                setUsername(res.data.Uusername);
                setEmail(res.data.Uemail);
                setDescription(res.data.Description);
                setNative(res.data.NativeLanguage);
                setLearning(res.data.LearningLanguage);
                if(res.data.Image != null) {
                    setUserImage("https://50.18.108.83.nip.io:3001/"+res.data.Image);
                    // setUserImage("http://localhost:3001/"+res.data.Image);
                }
                axios.post(`https://50.18.108.83.nip.io:3001/friends/count?user=${res.data.UserID}`)
                // axios.post(`http://localhost:3001/friends/count?user=${res.data.UserID}`)
                .then(res => {
                    setFollowers(res.data.count);
                })
                .catch(err => {
                    console.log(err);
                });
                axios.post('https://50.18.108.83.nip.io:3001/friend/following', {
                //axios.post('http://localhost:3001/friend/following', {
                    FriendID: res.data.UserID
                })
                .then(res => {
                    if(res.data.message) {
                        console.log(res.data.message);
                        setFollowing(false);
                    }
                })
                .catch(err => {
                    console.log(err)
                })
            })
            .catch(err => {
              console.log(err);
            });
        }
    },[]);

    return(
        <div className="friendsHeader">
        <header>
            <img src={Banner} alt="Ulingual Banner"></img>
        </header>
        <div className="friendsContainer">
            <div className="leftfriends">
                <img className="ProfileImages1" src ={userImage || "https://placehold.jp/150x150.png"}/>
                <h2 className="ProfileNames1">{username}</h2>
                <div className="friendsData">
                    <li>Email: {email}</li>
                    <li>Followers: {followers}</li>
                    <li>Native Language: {nativeLanguage}</li>
                </div>
                {!following ? (
                <div className="button">
                    <button onClick={(e) => follow(e)} className="bluebox">Follow</button>
                </div>
                ) : null}
                <div className="button">
                    <Link to="/FriendsListPage" className="bluebox">Return</Link>
                </div>
            </div>

            <div className="rightfriends">
                <div className="descriptionPacket" >
                    {description ? (
                        <h3>{description}</h3>
                    ) : (
                        <h3>No Description Available</h3>
                    )}
                </div>
                <div className="languagePacket">
                    <Link to="#" className="button">
                    <h3>Language Selected: {learningLanguage}</h3>
                    </Link>
                </div>
            </div>
        </div>
    </div>
    );
}

export default FriendsProfile;

