import React, { useCallback, useEffect, useState } from "react";
import Participant from "./Participant";
import { Video, LocalDataTrack } from "twilio-video";

const Room = ({ roomName, room, handleLogout, }) => {
  const [participants, setParticipants] = useState([]);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);

  useEffect(() => {
    // When a participant connects, the participantConnected function is called and the participant is added to the participants array.
    const participantConnected = (participant) => {
      setParticipants((prevParticipants) => [...prevParticipants, participant]);
    };

    // When a participant disconnects, the participantDisconnected function is called and the participant is removed from the participants array.
    const participantDisconnected = (participant) => {
      setParticipants((prevParticipants) =>
        prevParticipants.filter((p) => p !== participant)
      );
    };

    // Event listeners for when a participant connects or disconnects
    room.on("participantConnected", participantConnected);
    room.on("participantDisconnected", participantDisconnected);

    // Add all the participants that are already connected to the room to the participants array
    room.participants.forEach(participantConnected);

    // Unregister event listeners when the component unmounts
    return () => {
      room.off("participantConnected", participantConnected);
      room.off("participantDisconnected", participantDisconnected);
    };
  }, [room]);


  // Map each participant to a Participant component
  const remoteParticipants = participants.map((participant) => (
    <Participant key={participant.sid} participant={participant} />
  ));

  function createLocalVideoTrack() {
    return navigator.mediaDevices.getUserMedia({ video: true })
      .then((mediaStream) => {
        return new Video.LocalVideoTrack(mediaStream.getVideoTracks()[0]);
      })
      .catch((error) => {
        console.error('Error creating local video track:', error);
        return null;
      });
  }


  const toggleCamera = useCallback(async () => {
    if (room) {
      console.log("isVideoOn: " + isVideoOn);
      if (isVideoOn) {
        const localVideoTrack = room.localParticipant.videoTracks.values().next().value.track;
        console.log("this happens");
        if (localVideoTrack.isEnabled) {
          room.localParticipant.unpublishTrack(localVideoTrack);
          localVideoTrack.disable();
          setIsVideoOn(false);
          const localDataTrack = new LocalDataTrack();
          room.localParticipant.publishTrack(localDataTrack);
          localDataTrack.send(JSON.stringify({ type: 'videoOff' })); // Send a message to remote participants indicating that your video is turned off

        }
      } else {
        const newLocalVideoTrack = await createLocalVideoTrack();
        if (newLocalVideoTrack) {
          const localDataTrack = room.localParticipant.dataTracks.values().next().value.track;
          room.localParticipant.unpublishTrack(localDataTrack);
          room.localParticipant.publishTrack(newLocalVideoTrack);
          setIsVideoOn(true);

          const localVideoElement = document.getElementById('local-video');
          if (localVideoElement) {
            const newMediaStream = new MediaStream([newLocalVideoTrack.mediaStreamTrack]);
            localVideoElement.srcObject = newMediaStream;
          }

        }
      }

    }
  }, [room, isVideoOn]);


  const toggleAudio = useCallback(() => {
    if (room) {
      console.log("isAudioOn: " + isAudioOn);
      const localAudioTrack = room.localParticipant.audioTracks.values().next().value.track;
      if (isAudioOn) {
        localAudioTrack.disable();
        setIsAudioOn(false);
      } else {
        localAudioTrack.enable();
        setIsAudioOn(true);
      }
    }
  }, [room, isAudioOn]);

  /*
  const toggleCamera = useCallback(() => {
    if (room) {
      if (isVideoOn) {
        room.localParticipant.videoTracks.forEach((publication) => {
          publication.track.disable();
          room.localParticipant.unpublishTrack(publication.track);
        })
        setIsVideoOn(false);
      } else {
        room.localParticipant.videoTracks.forEach((publication) => { 
          publication.track.enable();
          room.localParticipant.publishTrack(publication.track);
        })
        setIsVideoOn(true);
      }
    }
  }, [room, isVideoOn]);
  */

  // Renders the video room
  return (
    <div className="room">
      <h2>Room: {roomName}</h2>
      <button onClick={handleLogout}>Log out</button>
      <button onClick={toggleCamera}> {isVideoOn ? "Turn Video Off" : "Turn Video On"}</button>
      <button onClick={toggleAudio}> {isAudioOn ? "Turn Audio Off" : "Turn Audio On"}</button>
      <div className="local-participant">
        {room ? (
          <Participant
            key={room.localParticipant.sid}
            participant={room.localParticipant}
            localParticipantIdentity={room.localParticipant.identity}
            isAudioOn={isAudioOn}
          />
        ) : (
          ""
        )}
      </div>
      <h3>Remote Participants</h3>
      <div className="remote-participants">{remoteParticipants}</div>
    </div>
  );
};

export default Room;
